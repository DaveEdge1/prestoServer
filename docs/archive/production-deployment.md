# Production Deployment Notes

## Quick-start

```bash
cp .env.example .env          # fill in all required secrets (see below)
docker-compose up -d
```

---

## Environment variables (`.env`)

### Required

| Variable | Description |
|---|---|
| `MYSQL_ROOT_PASSWORD` | MySQL root password |
| `MYSQL_USER` | App DB user |
| `MYSQL_PASSWORD` | App DB password |
| `SMTP_PASSWORD` | Zoho SMTP password for `no-reply@paleopresto.com` |
| `ENCRYPTION_KEY` | 32-byte hex key for encrypting stored GitHub tokens |
| `SESSION_SECRET` | Express session secret |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `GITHUB_WEBHOOK_SECRET` | Shared secret for GitHub webhook payloads |
| `GITHUB_CALLBACK_URL` | Full OAuth callback URL, e.g. `https://paleopresto.com/oauth/github/callback` |

### Optional / defaulted

| Variable | Default | Description |
|---|---|---|
| `BASE_URL` | `http://143.198.98.66` | Public base URL — set to your domain with https |
| `MYSQL_DATABASE` | `lipdverse` | Database name |
| `SMTP_HOST` | `smtp.zoho.com` | SMTP host |
| `SMTP_PORT` | `465` | SMTP port |
| `SMTP_USER` | `no-reply@paleopresto.com` | SMTP sender address |
| `GRAPHDB_URL` | `https://linkedearth.graphdb.mint.isi.edu` | GraphDB SPARQL endpoint |
| `USER_RECONS_PATH` | `/root/presto/userRecons` | Session data directory inside the container |
| `GITHUB_DEFAULT_VISIBILITY` | `public` | Visibility of user-forked repos |

---

## Data persistence

### What needs to survive container restarts

| Data | How it's persisted |
|---|---|
| MySQL database | Named volume `mysql-data` |
| User session files (`userRecons/`) | Named volume `user-recons-data` |
| Source code | Bind-mounted from the repo (see below) |
| Tile server tiles | Bind-mounted from `../customTiles/` (outside repo) |

### Named volumes vs. bind mounts for `userRecons`

The current setup uses a **named Docker volume** (`user-recons-data`) for `userRecons/`.
This is the recommended approach — data is managed by Docker and survives `docker-compose up` and image rebuilds.

If you want the data directly accessible on the host filesystem (e.g. for manual backups or inspection), replace the named volume with a bind mount in `docker-compose.yml`:

```yaml
# Instead of:
- user-recons-data:/root/presto/userRecons

# Use:
- /root/presto/userRecons:/root/presto/userRecons
```

Make sure the host directory exists first: `mkdir -p /root/presto/userRecons`

> **Note:** The `docker-compose.yml` also contains a commented-out "same-path strategy" mount (`/root/presto:/root/presto`). If you uncomment this, it will cover the entire `/root/presto` tree including `userRecons` — but it would also shadow the named volume and the individual source-code bind mounts. Do not mix the two approaches.

### Session data retention policy

The server runs a cleanup job on startup and every 24 hours (`services/cleanup.js`):

- Files **> 1 MB** (pkl, zip outputs from the traditional server pathway) — deleted after **7 days**
- Files **≤ 1 MB** (TSIDs.json, progress.json, configs) — deleted after **30 days**
- Empty session directories are removed automatically

This means data-cleaning resume links are valid for up to **30 days**.

---

## Source code mounts

The `docker-compose.yml` bind-mounts individual source directories so that code changes take effect on `docker-compose restart` without a rebuild:

```
./routes        → /root/presto/routes
./services      → /root/presto/services
./prestoForm    → /root/presto/prestoForm
./jsonEditor    → /root/presto/jsonEditor
./templates     → /root/presto/templates
./getLipds      → /root/presto/getLipds
./query         → /root/presto/query
./app.js        → /root/presto/app.js
```

To apply a code change:
```bash
docker-compose restart presto-orchestrator
```

To apply a `docker-compose.yml` or `Dockerfile` change:
```bash
docker-compose up -d
```

---

## Template repositories — manual steps required

### LMR template (`DaveEdge1/LMR2`)

The GitHub Actions workflow template must be manually updated via the GitHub web UI because the API cannot write workflow files without the `workflow` OAuth scope.

**Steps (do this before first production use):**

1. Go to `https://github.com/DaveEdge1/LMR2/blob/main/.github/workflows/cfr-custom.yml`
2. Click the pencil (Edit) icon
3. Replace the entire file content with `templates/workflows/LMR.yml` from this repo
4. Commit directly to `main`

Key things already fixed in `templates/workflows/LMR.yml`:
- Config path is `lmr_configs.yml` (no `config/` subdirectory in the template)
- Job has `permissions: contents: write`
- Artifact name uses `github.run_id` fallback for push-triggered runs

### LiPD download template (`DaveEdge1/lipd-downloads`) — NEW, CREATED ✓

Template repo: https://github.com/DaveEdge1/lipd-downloads

The workflow file `.github/workflows/lipd-download.yml` must match `templates/workflows/LiPDDownload.yml` in this repo.

The workflow is triggered by a push to `query_params.json` (committed by the server on submit). It runs `lipdGenerator` (format=lpd) and uploads `lipd_files.zip` as a 90-day GitHub Actions artifact.

---

## Useful commands

```bash
# Start all services
docker-compose up -d

# Apply code changes (no rebuild needed)
docker-compose restart presto-orchestrator

# View live logs
docker-compose logs -f presto-orchestrator

# Rebuild a specific service (e.g. after Dockerfile change)
docker-compose build proxy-analysis && docker-compose up -d proxy-analysis

# Inspect the userRecons volume
docker volume inspect prestoserver_user-recons-data

# Open a shell in the orchestrator container
docker exec -it prestoserver-presto-orchestrator-1 bash
```

---

## Services

| Service | Description | Exposed port |
|---|---|---|
| `presto-orchestrator` | Main Node.js app | Internal only (nginx proxies via 81) |
| `proxy-analysis` | FastAPI duplicate-detection service (port 8090) | Internal only |
| `mysql` | Database | Internal only |
| `nginx` | Reverse proxy | 80, 81, 83, 84, 85, 90 |
| `tile-server` | Blue Marble map tiles | 8080 |

### Tile server

Tile data lives **outside the repo** at `../customTiles/` (large binary files, not tracked in git).
Required directories:

```
../customTiles/blueMarble/tiles_mollweide/     → /tiles_bluemarble
../customTiles/blueMarble_3031/tiles/          → /tiles_bluemarble_3031
../customTiles/blueMarble_3995/tiles/          → /tiles_bluemarble_3995
```

Health check: `http://localhost:8080/health`
