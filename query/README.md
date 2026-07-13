# Query subsystem

The browser-facing query/selection UI for picking lipdverse datasets. Served by
`routes/query.js` (part of the consolidated orchestrator — no standalone server).

## How it's served

- `GET /query/:recon` renders the **unified template** `query.html`, injecting a
  per-recon `PAGE_CONFIG` from `presto/reconRegistry.json` (the `pageConfig`
  field). One template drives every recon (LMR, holocene_da, lipdDownload /
  download / downloadNew, temp12k, BayGMST, graph_em, …). Edit `query.html`
  only, then restart the orchestrator.
- `GET /query/` serves `index.html`.
- Static assets (Leaflet, `mapManager.js`, `mollweide-crs.js`, `queryHelpers.js`,
  map tiles, CSS, …) live under `query/public/` and are served at `/query/*`.
- Database-backed lookups (autocomplete, dataset filtering) are handled by
  `routes/data.js` (formerly the standalone `queryDB.js`), which builds MySQL
  `WHERE` clauses from query-string filters, e.g.
  `?archiveType=Wood,Coral&paleoData_proxy=ring width,maximum latewood density`
  → `WHERE (archiveType IN ('Wood','Coral')) AND (paleoData_proxy IN (...))`.

Actual reconstruction data generation runs in the `lipdGenerator` container and
GitHub Actions — not in this subsystem.

## Keeping the lipdverse MySQL cache in sync

The `*.py` / `*.sh` scripts here are an operational toolkit (run in the
`lipdverse-db` conda env) for refreshing and validating the `query` MySQL table:

- `setup_env.sh` — create the conda env from `environment.yml`
- `run_update.sh` → `update_lipdverse_db.py` — download + load the latest lipdverse export
- `run_check.sh` → `check_mysql_sync.py` — compare the DB against the CSV
- `run_check_actual.sh` → `check_actual_query.py` — run the web form's exact query

Credentials come from the environment (`MYSQL_HOST` / `MYSQL_USER` /
`MYSQL_PASSWORD` / `MYSQL_DATABASE`) — do not hard-code them. See
`QUICKSTART.md`, `CONDA_SETUP.md`, and `UPDATE_DATABASE_README.md`.
