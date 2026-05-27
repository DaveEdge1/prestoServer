# Paleo Presto Server

Web platform for running paleoclimate reconstructions (LMR, Holocene DA, temp12k, …) against [lipdverse](https://lipdverse.org/) data. Users configure a reconstruction in the browser, the orchestrator forks a per-recon template repo into the user's GitHub account, and the reconstruction runs as a GitHub Actions workflow there. Results are committed back to the user's fork and published via GitHub Pages.

**Live:** http://143.198.98.66:84/forms/

## Architecture

```
┌──────────────┐    ┌──────────────────────────────────────────────┐
│   Browser    │ ─► │  nginx ─► presto-orchestrator (Express)      │
└──────────────┘    │            │                                  │
                    │            ├─ MySQL (lipdverse cache, tokens) │
                    │            ├─ proxy-analysis (FastAPI)        │
                    │            ├─ tile-server (Blue Marble)       │
                    │            └─ lipdGenerator (one-shot worker) │
                    └─────────────────┬────────────────────────────┘
                                      │ fork + dispatch
                                      ▼
                    ┌──────────────────────────────────────────────┐
                    │  GitHub Actions in user's fork of            │
                    │  DaveEdge1/<template> (LMR2, presto-…, …)    │
                    │  → runs reconstruction container             │
                    │  → commits results + publishes Pages         │
                    └──────────────────────────────────────────────┘
```

The orchestrator (`app.js`) consolidates what used to be 9 separate Node services into one Express app, with route modules under `routes/`. It does not run reconstructions itself — its job is to serve the form/query/editor UIs, fork the template repo via the GitHub API, write user inputs into the fork, and dispatch the workflow.

## Quickstart (local dev)

Prereqs: Docker Desktop, Node 18+, a GitHub OAuth app (for login flow).

```bash
git clone <this repo>
cd prestoServer
cp .env.example .env        # fill in GitHub OAuth + DB creds
docker-compose up -d
```

Open http://localhost/forms — the orchestrator is behind nginx on port 80.

Code reloads: source dirs (`routes/`, `services/`, `prestoForm/`, `jsonEditor/`, `templates/`, `getLipds/`, `query/`, `app.js`) are bind-mounted, so:

```bash
docker-compose restart presto-orchestrator
docker-compose logs -f presto-orchestrator
```

## Repo layout

```
app.js                  Express entry point
routes/                 Route modules: oauth, forms, query, datacleaning,
                        editor, reconstruct, downloads, viz, …
services/               github.js (fork + dispatch), lipdDataService.js,
                        cleanup.js, compilationUpdater.js, logger, metrics
config/                 Central config (port, baseUrl, MySQL, paths)
prestoForm/             Per-recon UI + translation logic (one dir per recon)
query/                  Shared query UI (one template, multiple recons)
jsonEditor/             Parameter editor generator (writeForm.js → HTML/JS)
getLipds/               Worker containers used by the orchestrator
                          lipdGenerator/   download + filter lipdverse data
                          lipdPickler/     (legacy, filtered path)
                          proxyAnalysis/   PCA + spatial dedup service
templates/workflows/    GitHub Actions workflow templates (per recon)
nginx/                  Reverse proxy config
monitoring/             Prometheus, Grafana, Loki, Promtail configs
docs/                   Deeper docs
```

Worker containers published as `davidedge/lipd_webapps:<tag>` (lipdGenerator, lipdPickler, holocene_da) and `davidedge/lmr2:latest`.

## Adding a new reconstruction

Reconstruction methods are registered in a single source of truth,
`presto/reconRegistry.json` — in the common case, adding a method needs **no
server code**, just a new `prestoForm/<handle>/` folder and one registry entry.

See **[docs/adding-a-reconstruction.md](docs/adding-a-reconstruction.md)** for the
full guide, and open your PR with the
[pull request template](.github/PULL_REQUEST_TEMPLATE.md) checklist.

