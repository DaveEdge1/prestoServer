# Production Runbook — `https://custom.paleopresto.com/`

Target: rootless Podman on a university Linux host, fronted by the existing
`paleopresto.com` reverse proxy (which terminates TLS).

## 1. One-time host prep

Run as the deploy user (not root). `loginctl enable-linger` must be set by an
admin if it isn't already.

```bash
# As an admin, once (skip if already done — check with: loginctl show-user cefns_lipd -p Linger):
sudo loginctl enable-linger cefns_lipd

# As cefns_lipd (ssh nau-presto), once:
systemctl --user enable --now podman.socket
echo 'export XDG_RUNTIME_DIR=/run/user/$(id -u)' >> ~/.bashrc
source ~/.bashrc

# Verify the rootless socket is live
ls -l "$XDG_RUNTIME_DIR/podman/podman.sock"

# Install podman-compose if not already present
pip install --user podman-compose
```

Layout under `~/presto` (create once, owned by deploy user):

```
~/presto/
├── docker-compose.prod.yml     # scp'd from this repo, no git clone needed
├── .env.production             # secrets, chmod 600
├── secrets/
│   └── github-app-private-key.pem   # if using GitHub App
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
from Docker Hub, so the server never clones the repo or builds anything.

## 2. Secrets — rotate everything and write `.env.production`

Every value currently committed to the dev `.env` must be regenerated for prod.
Do not reuse them.

```bash
# From the dev machine (once):
scp .env.production.example nau-presto:~/presto/.env.production

# On the server (ssh nau-presto):
chmod 600 ~/presto/.env.production

# Generate fresh 256-bit keys
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # SESSION_SECRET

# Edit and fill in all blanks, especially:
#   GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET   (new OAuth app — see §4)
#   MYSQL_PASSWORD / MYSQL_ROOT_PASSWORD
#   SMTP_PASSWORD
```

**Important:** rotating `ENCRYPTION_KEY` invalidates every encrypted token in
the `github_tokens` table. This is expected on a fresh prod DB; users re-auth
the next time they log in.

## 3. Tile data transfer

One-time rsync from the dev workstation. The local `customTiles/` directory
also holds source TIFFs, VRTs, intermediate PNGs, and a nested compose file
that the orchestrator does **not** need — only the 8 leaf directories the
compose file mounts as bind volumes have to ship. Use `rsync --relative` with
`/./` markers so the directory layout is preserved on the server:

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
  nau-presto:~/presto/customTiles/
```

The `-R` (`--relative`) flag plus the `/./` marker tells rsync to recreate
only the path *after* the dot on the destination — so the server ends up
with `~/presto/customTiles/blueMarble/tiles_mollweide/` (and the seven
siblings), not the full source path.

## 4. GitHub OAuth production app

Register a **new** OAuth app for production (keeps the dev app's callback URL
unchanged):

1. Go to https://github.com/settings/developers → **New OAuth App**
2. Homepage URL: `https://custom.paleopresto.com/`
3. Authorization callback URL: `https://custom.paleopresto.com/oauth/github/callback`
4. Generate a client secret, copy both values into `~/presto/.env.production`

If using the GitHub App path for anonymous reconstructions, either register a
second GitHub App for prod or update the existing one's webhook/callback URLs
to point at `custom.paleopresto.com`.

## 5. Upstream reverse proxy vhost (IT has completed this)

IT has already configured the `custom.paleopresto.com` subdomain and assigned
us port **9025** on the podman host. The snippet below is the config they
installed — kept here for reference in case SSE/timeouts/`X-Forwarded-Proto`
need tuning later:

```nginx
server {
    listen 443 ssl http2;
    server_name custom.paleopresto.com;

    # ssl_certificate / ssl_certificate_key ... (existing wildcard or new cert)

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:9025;   # or whichever internal IP the podman host uses
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        # Long timeout for reconstruction jobs and SSE
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_buffering off;
    }
}

# In the http {} block, ensure this map exists once:
# map $http_upgrade $connection_upgrade { default upgrade; '' close; }
```

`nginx/nginx.prod.conf` already trusts `127.0.0.1` for real-IP and
`X-Forwarded-Proto` — correct since IT's proxy runs on the same host.

## 6. Build/push images (dev machine) + deploy (server)

Images are built and pushed from a dev machine, not the server. The server
only pulls pre-built images from Docker Hub.

### From the dev machine (first time + every release):

```bash
# Log in once:
docker login docker.io   # or: podman login docker.io

# From the repo root:
./scripts/build-and-push.sh                # builds + pushes :latest
./scripts/build-and-push.sh v2026-04-21    # optional rollback tag
```

This builds and pushes four images:

- `docker.io/davidedge/presto-orchestrator:latest`
- `docker.io/davidedge/presto-nginx:latest`
- `docker.io/davidedge/presto-tile-server:latest`
- `docker.io/davidedge/presto-proxy-analysis:latest`

Ship the compose file to the server (only needed when it changes):

```bash
scp docker-compose.prod.yml nau-presto:~/presto/
```

### On the server (first time + every release):

```bash
cd ~/presto
podman-compose -f docker-compose.prod.yml pull
podman-compose -f docker-compose.prod.yml up -d
podman-compose -f docker-compose.prod.yml logs -f presto-orchestrator
```

To stop: `podman-compose -f docker-compose.prod.yml down`.
Named volumes `mysql-data` and `user-recons-data` persist across `down`/`up`.

### Rollback

If `:latest` is bad, pin the compose file to a version tag:

```yaml
# in docker-compose.prod.yml, e.g.
image: docker.io/davidedge/presto-orchestrator:v2026-04-21
```

then scp + `pull` + `up -d` again.

## 7. End-to-end verification

After the first deploy, walk through all of these:

1. `curl -I https://custom.paleopresto.com/` → `200`. Orchestrator logs should
   show the request with a real client IP and `X-Forwarded-Proto: https`.
2. Open the site and log in with GitHub → OAuth round-trips; `github_tokens`
   row appears in MySQL (encrypted).
3. Run the **archived** compilation path: form submit → template repo fork →
   workflow dispatch → repo visible under the user's GitHub.
4. Run the **filtered TSID** path: `/query` → `/datacleaning` loads, duplicates
   + PCA render (proves `proxy-analysis` reachable internally), **Continue**
   writes `cleaned_TSIDs.json`, `/editor/querypath` dispatches the workflow.
5. Inspect `podman ps` during a reconstruction — sibling container spawned by
   `prestoGo.js` via the mounted Podman socket is present.
6. Load any page with a map → tile requests are `200` (check Network tab for
   same-origin `/tiles_bluemarble/...` paths, not `localhost:8080`).
7. Login response `Set-Cookie` carries `Secure; HttpOnly` flags.
8. Trigger a failing reconstruction → email from `no-reply@paleopresto.com`
   arrives with `https://custom.paleopresto.com/...` links (not `localhost`
   or the old `143.198.98.66` droplet).

## 8. Operational notes

- **Logs:** `podman-compose -f docker-compose.prod.yml logs -f <service>`.
- **MySQL backup:** exec into the mysql container for `mysqldump`, or snapshot
  the `mysql-data` named volume. Not automated yet — add cron if needed.
- **Cleanup:** `services/cleanup.js` auto-prunes `userRecons/` (files >1 MB
  after 7 days, smaller files after 30 days). Runs on startup + every 24h.
- **Image updates:** bump `FROM` lines in Dockerfiles or pull fresh upstream
  images, then `podman-compose ... build --no-cache` + `up -d`.
- **Socket path:** if Podman is upgraded and the socket moves, adjust
  `docker-compose.prod.yml` volume `${XDG_RUNTIME_DIR}/podman/podman.sock`.

## 9. Deferred / out of scope

- CI/CD auto-deploy pipeline.
- Pushing locally-built images (orchestrator, tile-server, proxy-analysis) to
  a registry — currently built on the server.
- Automated DB backups / DR plan.
- Log aggregation / metrics export.
