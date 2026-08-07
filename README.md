# Paleo Presto Server

Web platform for running paleoclimate reconstructions (LMR, Holocene DA, temp12k, …) against [lipdverse](https://lipdverse.org/) data. Users configure a reconstruction in the browser, the orchestrator generates a per-recon repo from a template into the user's GitHub account (GitHub "Use this template"), and the reconstruction runs as a GitHub Actions workflow there. Results are committed back to the user's repo and published via GitHub Pages.

**Live:** https://custom.paleopresto.com/forms/

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
                                      │ create-from-template + dispatch
                                      ▼
                    ┌──────────────────────────────────────────────┐
                    │  GitHub Actions in user's copy of            │
                    │  DaveEdge1/<template> (LMR2, presto-…, …)    │
                    │  → runs reconstruction container             │
                    │  → commits results + publishes Pages         │
                    └──────────────────────────────────────────────┘
```

The orchestrator (`app.js`) consolidates what used to be 9 separate Node services into one Express app, with route modules under `routes/`. It does not run reconstructions itself — its job is to serve the form/query/editor UIs, generate the user's repo from the template via the GitHub API, write user inputs into it, and dispatch the workflow.

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
                        editor, lipds, lipdDownload, reuse, downloads, viz,
                        data, sparql, posttsids, status, webhooks
services/               github.js / githubApp.js (create-from-template +
                        dispatch), db.js, cleanup.js, compilationUpdater.js,
                        logger.js, metrics.js
config/                 Central config (port, baseUrl, MySQL, paths)
presto/                 reconRegistry.json — single source of truth for recon
                        methods; generateReconLib.js regenerates reconLib.json
prestoForm/             Per-recon UI + translation logic (one dir per recon)
query/                  Shared query UI (one template, multiple recons)
jsonEditor/             Parameter editor generator (writeForm.js → HTML/JS)
getLipds/               Worker containers used by the orchestrator
                          lipdGenerator/   download + filter lipdverse data
                          lipdPickler/     (legacy, filtered path)
                          proxyAnalysis/   PCA + spatial dedup service
                          holoceneDA/      Holocene DA container
templates/              workflows/ (per-recon GitHub Actions) + scripts/
nginx/                  Reverse proxy config
monitoring/             Prometheus, Grafana, Loki, Promtail configs
scripts/                Operational/build scripts (build-and-push, DB updates)
docs/                   Deeper docs (deployment runbooks, contributor guides;
                        archive/ holds superseded historical docs)
```

Worker containers published as `davidedge/lipd_webapps:<tag>` (lipdGenerator, lipdPickler, holocene_da, holocene_da_viz) and `davidedge/lmr2:latest`.

## Adding a new reconstruction

Reconstruction methods are registered in a single source of truth,
`presto/reconRegistry.json` — in the common case, adding a method needs **no
server code**, just a new `prestoForm/<handle>/` folder and one registry entry.

See **[docs/adding-a-reconstruction.md](docs/adding-a-reconstruction.md)** for the
full guide, and open your PR with the
[pull request template](.github/PULL_REQUEST_TEMPLATE.md) checklist.

## License

[Apache-2.0](LICENSE)

