# Production Runbook — `http://143.198.98.66:84/` (Digital Ocean droplet)

Target: a Digital Ocean Linux droplet running **Docker** (not rootless Podman),
exposed directly on port **80** with **no upstream reverse proxy**. Traffic
hits the droplet's nginx container directly.

> **Assumptions baked into this runbook (correct any that don't match):**
> - Docker Engine + docker-compose-plugin installed on the droplet.
> - Deploy user has `sudo` (or is root). All commands run as that user.
> - HTTP-only for now; raw IP, no domain. TLS is deferred to §10.
> - Public URL is `http://143.198.98.66:84` until a domain is attached.

If you want HTTPS now, jump to §10 first — the OAuth callback URL chosen in
§4 must match the final URL, otherwise GitHub login breaks after switching.

## 1. One-time host prep

```bash
# As root or sudo user on the droplet:

# Docker (skip if already installed)
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# Add deploy user to docker group so compose runs without sudo
usermod -aG docker $USER
# Log out / back in for the group change to take effect.

# Verify
docker version
docker compose version
```

Layout under `~/presto` on the droplet (create once, owned by deploy user):

```
~/presto/
├── docker-compose.do.yml       # this deployment's compose file (see §6)
├── .env.production             # secrets, chmod 600
├── secrets/
│   └── github-app-private-key.pem   # only if using the GitHub App path
└── customTiles/                # rsynced from dev machine (see §3)
    ├── blueMarble/tiles_mollweide/
    ├── blueMarble_3031/tiles/
    ├── blueMarble_3995/tiles/
    ├── blueMarble_3857/tiles/
    ├── naturalEarth_3857/tiles/
    ├── naturalEarth_mollweide/tiles/
    ├── naturalEarth_3031/tiles/
    └── naturalEarth_3995/tiles/
```

All application code ships inside the four `davidedge/presto-*` images pulled
from Docker Hub, so the droplet never clones the repo or builds anything.

## 2. Firewall

DO droplets typically have `ufw` available. Open only what you need:

```bash
ufw allow OpenSSH
ufw allow 84/tcp
# Add 443 later if/when you set up TLS (§10)
ufw enable
ufw status
```

If a DO **Cloud Firewall** is attached to the droplet, mirror the same rules
there (inbound 22 + 84 from anywhere) — droplet-level `ufw` and the cloud
firewall are independent.

## 3. Secrets — rotate everything and write `.env.production`

Every value committed to dev `.env` must be regenerated for prod. Do not reuse.

```bash
# From the dev machine (once):
scp .env.production.example root@143.198.98.66:~/presto/.env.production

# On the droplet:
chmod 600 ~/presto/.env.production

# Generate fresh 256-bit keys (run on the droplet or dev machine):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # SESSION_SECRET
```

Edit `~/presto/.env.production`. **Override the defaults that assume the
university domain:**

```ini
# Public URL — raw IP, http (no domain yet)
BASE_URL=http://143.198.98.66:84
CORS_ORIGINS=http://143.198.98.66:84

# GitHub OAuth — new prod app from §4
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_CALLBACK_URL=http://143.198.98.66:84/oauth/github/callback

# Plus all other blanks: MYSQL_*, SMTP_PASSWORD, ENCRYPTION_KEY, SESSION_SECRET
```

**Important:** rotating `ENCRYPTION_KEY` invalidates every encrypted token in
the `github_tokens` table. Expected on a fresh prod DB; users re-auth on next
login.

## 4. Tile data transfer

The local `customTiles/` directory also holds source TIFFs, VRTs,
intermediate PNGs, and a nested compose file that the orchestrator does
**not** need — only the 8 leaf directories the compose file mounts as bind
volumes have to ship. Use `rsync --relative` with `/./` markers so the
directory layout is preserved on the droplet:

```bash
# From the dev machine (adjust source path):
rsync -avhR --progress \
  /c/Users/dce25/customTiles/./blueMarble/tiles_mollweide \
  /c/Users/dce25/customTiles/./blueMarble_3031/tiles \
  /c/Users/dce25/customTiles/./blueMarble_3995/tiles \
  /c/Users/dce25/customTiles/./blueMarble_3857/tiles \
  /c/Users/dce25/customTiles/./naturalEarth_3857/tiles \
  /c/Users/dce25/customTiles/./naturalEarth_mollweide/tiles \
  /c/Users/dce25/customTiles/./naturalEarth_3031/tiles \
  /c/Users/dce25/customTiles/./naturalEarth_3995/tiles \
  root@143.198.98.66:~/presto/customTiles/
```

The `-R` (`--relative`) flag plus the `/./` marker tells rsync to recreate
only the path *after* the dot on the destination — so the droplet ends up
with `~/presto/customTiles/blueMarble/tiles_mollweide/` (and the seven
siblings), not the full source path.

## 5. GitHub OAuth production app

Register a **new** OAuth app for this droplet (so it doesn't collide with the
dev app or the university prod app):

1. https://github.com/settings/developers → **New OAuth App**
2. Homepage URL: `http://143.198.98.66:84/`
3. Authorization callback URL: `http://143.198.98.66:84/oauth/github/callback`
4. Generate a client secret, copy both values into `~/presto/.env.production`.

> GitHub *does* accept raw IPs as OAuth callback URLs, but every visitor will
> see a "third-party application" consent screen with the IP rather than a
> domain. Switch to a domain (§10) before sharing the URL widely.

If you also use the GitHub App path for anonymous reconstructions, register a
separate GitHub App for this droplet or update the existing one's webhook /
callback URLs to point at `http://143.198.98.66:84`.

## 6. Compose file for this deployment

This repo ships `docker-compose.do.yml` alongside `docker-compose.prod.yml`.
The DO variant differs in three places:

- Mounts `/var/run/docker.sock` (Docker) instead of the rootless Podman
  socket under `$XDG_RUNTIME_DIR`.
- Binds nginx directly to `0.0.0.0:80` instead of `127.0.0.1:9025` (no
  upstream TLS proxy).
- Drops the `:z` SELinux relabel suffixes on bind mounts (Ubuntu/Debian
  default kernel doesn't relabel).

```bash
# From dev:
scp docker-compose.do.yml root@143.198.98.66:~/presto/
```

> The orchestrator uses the mounted Docker socket to spawn sibling
> reconstruction containers (`prestoGo.js`). Mounting `/var/run/docker.sock`
> grants root-equivalent host access to the orchestrator container — fine for
> a single-tenant deployment but worth knowing.

## 7. Build/push images (dev machine) + deploy (droplet)

Images are built and pushed from a dev machine. The droplet only pulls.

### From the dev machine (first time + every release):

```bash
docker login docker.io                 # once
./scripts/build-and-push.sh            # builds + pushes :latest
./scripts/build-and-push.sh v2026-04-27   # optional rollback tag
```

This pushes:
- `docker.io/davidedge/presto-orchestrator:latest`
- `docker.io/davidedge/presto-nginx:latest`
- `docker.io/davidedge/presto-tile-server:latest`
- `docker.io/davidedge/presto-proxy-analysis:latest`

Ship the compose file (only when it changes):

```bash
scp docker-compose.do.yml root@143.198.98.66:~/presto/
```

### On the droplet (first time + every release):

```bash
cd ~/presto
docker compose -f docker-compose.do.yml pull
docker compose -f docker-compose.do.yml up -d
docker compose -f docker-compose.do.yml logs -f presto-orchestrator
```

To stop: `docker compose -f docker-compose.do.yml down`. Named volumes
`mysql-data`, `user-recons-data`, and `lipd-cache-data` persist across
`down`/`up`.

### Rollback

If `:latest` is bad, pin a version tag in `docker-compose.do.yml`:

```yaml
image: docker.io/davidedge/presto-orchestrator:v2026-04-27
```

then scp + `pull` + `up -d`.

## 8. End-to-end verification

After the first deploy, walk through all of these:

1. `curl -I http://143.198.98.66:84/` → `200`. Orchestrator logs show the
   request with the real client IP.
2. Open the site, log in with GitHub → OAuth round-trips; `github_tokens` row
   appears in MySQL (encrypted).
3. **Archived** path: form submit → template repo fork → workflow dispatch →
   repo visible under the user's GitHub.
4. **Filtered TSID** path: `/query` → `/datacleaning` loads, duplicates + PCA
   render (proves `proxy-analysis` is reachable internally), **Continue**
   writes `cleaned_TSIDs.json`, `/editor/querypath` dispatches the workflow.
5. `docker ps` during a reconstruction shows the sibling container
   `prestoGo.js` spawned via the mounted Docker socket.
6. Map pages: tile requests are `200` and same-origin (`/tiles_bluemarble/...`,
   not `localhost:8080`).
7. Trigger a failing reconstruction → email from `no-reply@paleopresto.com`
   carries `http://143.198.98.66:84/...` links.

> **Cookie note for HTTP-only deployments:** the orchestrator's session
> cookie should not have the `Secure` flag set, otherwise browsers will drop
> it over plain HTTP and login will silently fail. If you see "logged in then
> immediately logged out" behaviour, check `services/sessionConfig.js` (or
> equivalent) and confirm `cookie.secure` is `false` when `BASE_URL` is
> `http://...`. The university prod runbook relies on `X-Forwarded-Proto:
> https` from the upstream proxy to flip this on; on the DO droplet there is
> no upstream proxy, so `$scheme` in `nginx.prod.conf` will correctly resolve
> to `http`.

## 9. Operational notes

- **Logs:** `docker compose -f docker-compose.do.yml logs -f <service>`.
- **MySQL backup:** `docker exec -i prestoserver-mysql-1 mysqldump ...` or
  snapshot the `mysql-data` named volume. Not automated yet.
- **Cleanup:** `services/cleanup.js` auto-prunes `userRecons/` (files >1 MB
  after 7 days, smaller after 30 days). Runs on startup + every 24h.
- **Image updates:** rebuild on dev, re-push, then on the droplet:
  `docker compose -f docker-compose.do.yml pull && docker compose -f
  docker-compose.do.yml up -d`.
- **DO snapshots:** before risky changes, take a droplet snapshot from the DO
  console — fastest possible rollback.

## 10. Adding TLS later (deferred)

When a domain is attached, the cleanest upgrade path:

1. Point an A record at `143.198.98.66`.
2. Add a Caddy or certbot+nginx sidecar that terminates TLS on `:443` and
   proxies to the existing nginx container on `:81` (same port mapping the
   university setup uses internally).
3. Update `BASE_URL`, `CORS_ORIGINS`, `GITHUB_CALLBACK_URL` in
   `.env.production` to `https://<domain>`.
4. Update the GitHub OAuth app's Homepage + Callback URLs.
5. Confirm `cookie.secure` flips back on (Express sees `X-Forwarded-Proto:
   https` from the TLS-terminating sidecar).

## 11. Pre-flight URL audit (2026-04-27)

A sweep of the codebase was done before writing this runbook. Summary:

**Runtime URL behaviour is fully env-driven** — nothing in the orchestrator's
hot path (`app.js` + `routes/*` + `services/*`) hard-codes a deployment URL.
All redirects, callback URLs, and absolute links built server-side go through
`config.baseUrl`, `config.corsOrigins`, or `config.github.callbackUrl`, which
read directly from the env vars set in `.env.production`.

**Safe defaults already in place:**
- `app.js:53` — `cookie.secure` is auto-derived from `BASE_URL.startsWith('https://')`,
  so HTTP deployments correctly *don't* set the `Secure` flag and login works.
- `app.js:60` — `app.set('trust proxy', true)` honours `X-Forwarded-*` from
  the nginx container.
- `nginx/nginx.prod.conf:27` — `server_name custom.paleopresto.com _;` — the
  `_` wildcard accepts any Host header, so IP-based access works unchanged.

**Hardcoded URLs that look scary but don't affect runtime** (no action
required, recorded so reviewers don't chase them):
- `prestoForm/formServer.js`, `jsonEditor/editorServer.js`,
  `graphDB/sparqlServer.js`, `getLipds/Rserver.js`,
  `query2parms/postTSidsServer.js` — legacy 9-server architecture, replaced
  by the consolidated `app.js` + `routes/*`. Not loaded by the orchestrator
  image.
- `query/downloadNew.html:609,639,669` — hardcoded `http://localhost:8080/`
  tile URLs. Superseded by the unified `query/query.html` template that
  `routes/query.js` serves for every `/query/:recon` (including
  `downloadNew`). Dead code.
- Marketing/branding links to `https://paleopresto.com/` in `services/github.js`,
  `query/index.js`, `routes/forms.js`, `routes/reconstruct.js`,
  `routes/webhooks.js`, `presto/prestoGo.js`. These point at the public
  project homepage, not the deployment, and should stay.
- SMTP from-address `no-reply@paleopresto.com` — also stays; that's the
  email domain regardless of where the orchestrator runs.

**Stale documentation to ignore:**
- `DEPLOYMENT_CHECKLIST.md`, `GITHUB_ACTIONS_DEPLOYMENT.md`,
  `HYBRID_ARCHITECTURE.md`, `HYBRID_DEPLOYMENT_GUIDE.md` all reference
  `http://143.198.98.66:84/webhooks/github`. They predate `production-runbook.md`
  and may contradict it. Treat this runbook + `production-runbook.md` as
  the source of truth.

**GitHub webhook URL** (if/when you wire up GitHub App webhooks for this
deployment): `http://143.198.98.66:84/webhooks/github` — already the URL the
older docs assume, so no surprises there.

## 12. Out of scope

- CI/CD auto-deploy.
- Automated DB backups / DR plan.
- Log aggregation / metrics export.
- Multi-tenant hardening (the mounted Docker socket gives the orchestrator
  root-equivalent host access — acceptable for single-tenant only).
