# Plan: Add BayGMST reconstruction method

Bayesian global mean surface temperature reconstruction (R + STAN). Follows the
LMR pattern: GitHub template repo + `cfr-custom`-style Actions workflow +
container, dispatched from the presto orchestrator.

Branch (when work resumes): `BayGMST`.

## Open questions to resolve before implementation

1. **Template repo name** — assume `DaveEdge1/BayGMST` mirroring `LMR2` and
   `presto-holocene_da`?
2. **R/STAN source code** — already have a working STAN model + driver script,
   or is wrapping that part of this branch's work?
3. **Container** — build a new `davidedge/lipd_webapps:BayGMST` image
   (R + `cmdstanr`/`rstan`)? Or is there an existing image?
4. **Time range / target** — GMST only (1D time series), or also a spatial
   field? Affects viz and `reconsTable.json`.
5. **LiPD inputs** — consume the same `lipd.pkl` the LMR pickler produces, or
   raw `.lpd`s / a different format?
6. **Workflow trigger** — match LMR exactly (push to `query_params.json`
   triggers the workflow)? Cleanest fit given "same as LMR" choice.
7. **Existing dirty state on master** —
   `query/public/compilationMetadata.js` is modified and
   `db/migrations/005_add_lipdDownload_recon_type.sql` is untracked when this
   plan was written. Carry both onto the new branch, or commit/stash on master
   first?

## Phase 0 — branch + scaffolding

- `git checkout -b BayGMST` (carrying the two pending changes unless decided
  otherwise)
- Add `prestoForm/BayGMST/` directory skeleton

## Phase 1 — database

- New migration `db/migrations/006_add_BayGMST_recon_type.sql` extending the
  `recon_type` ENUM. Migration 005 already adds `lipdDownload`; 006 adds
  `BayGMST`.

## Phase 2 — GitHub template repo (external; manual + scripted)

Create `DaveEdge1/BayGMST` on GitHub with:

- `.github/workflows/cfr-custom.yml` — push-triggered on `query_params.json`,
  accepts `lipd_data_url` + `lipd_query_json` like LMR
- `bayGMST_configs.yml` — base config (overridden by user-pushed file)
- Driver script that reads config + lipd pickle + prior + instrumental field,
  runs STAN, writes `results/`
- README with PReSto branding

## Phase 3 — Docker image

- New `containers/bayGMST/` (or wherever fits) with `Dockerfile` + `environ.yml`
  (or `renv.lock`) for R + STAN deps
- Tag `davidedge/lipd_webapps:BayGMST`
- Mount points consistent with LMR: `/app/lipd_cfr.pkl`, config at `/app/...`,
  output `/recons`

## Phase 4 — forms page (server-side surface)

- `prestoForm/index.html` ~L325-332 — add `<option value="BayGMST">` to method
  dropdown
- `prestoForm/index2.html` ~L183 — confirm routing (no special-case needed if
  BayGMST uses its own query page)
- `prestoForm/BayGMST/` — new directory with:
  - `configs.yml` — editor form schema for the method's tunables
  - `config_default.yml` — defaults pushed to the template
  - `lookup.json` — form-key → config-key mapping (mirrors
    `holocene_da/lookup.json`)
  - `translate.js` — same shape as `prestoForm/holocene_da/translate.js`
  - `querypathconfigs.yml`, `formIntro.txt`, `abstract.txt`, `doi.txt`,
    `github.txt`
- `prestoForm/public/reconsTable.json` — add BayGMST card (title, time range,
  proxies, models, methods, DOI, language)

## Phase 5 — query page

- `routes/query.js` L18-46 — add `BayGMST` to `PAGE_CONFIGS` (timeSlider range,
  default compilation, `interpVarDefault`)
- `query/public/datacleaningApp.js` L1834 — decide if BayGMST gets LMR-style
  annual-resolution preference ranking (likely yes if it's annually resolved)

## Phase 6 — editor + backend translation

- `routes/editor.js` L201 — extend
  `(recon === 'LMR' || recon === 'holocene_da')` to include `BayGMST` for the
  LiPD-data branch (so it picks up `query_params.json`, `cleaned_TSIDs.json`,
  `variable_filter.yaml`)
- `routes/editor.js` L292 — extend the
  `recon !== 'LMR' && recon !== 'holocene_da'` workflow-dispatch guard to also
  exclude `BayGMST` (push-triggered)
- `routes/forms.js` L85 — add a branch if BayGMST needs a custom config
  download (likely yes)

## Phase 7 — GitHub service (`services/github.js`)

- L114-119 — add `'BayGMST': { owner: 'DaveEdge1', name: 'BayGMST' }` to
  template registry
- L292 — extend the config-path conditional: BayGMST gets its own filename
  (e.g. `bayGMST_configs.yml`)
- L313-348 — add a `recon === 'BayGMST'` branch that loads
  `prestoForm/BayGMST/lookup.json` + `config_default.yml` and merges form
  values (mirror holocene_da logic)
- L396 — add `BayGMST` to the `query_params.json` commit condition
- L405 — add `BayGMST` to the `variable_filter.yaml` commit condition
- L408-414 — decide if BayGMST needs scripts copied like LMR's
  `lipd_to_pdb.py` / `combine_seeds.py` (probably yes for the R driver, or
  none if the template repo carries them)

## Phase 8 — reuse + reconLib

- `routes/reuse.js` L190-215 — add BayGMST entry to `excludedKeys` + parameter
  rename map
- `presto/reconLib.json` — add BayGMST entry: Docker tag, config path, results
  dir
- `config/index.js` L63 — add path entry only if the orchestrator needs to
  mount BayGMST source (likely not, since execution is on GitHub Actions)

## Phase 9 — verification

- `docker-compose restart presto-orchestrator`
- End-to-end smoke: forms → query → datacleaning → editor → submit → confirm
  template fork + `cfr-custom.yml` triggers in the user's repo
- STAN run itself can't be tested without the model code

## Risk callouts

- The **template repo + workflow + container** trio is the long pole. If the
  STAN model isn't already runnable in a container, expect that to dominate.
  Server-side wiring is mechanical by comparison.
- **Migration 005** is untracked on master — that's a separate piece of work
  that's not yet committed. If 006 lands first, the ENUM ordering will need
  to be reconciled.
- `presto/reconLib.json` and `prestoForm/public/reconsTable.json` are flagged
  as registries to add to — worth verifying these are still load-bearing
  (some legacy paths in `presto/prestoGo.js` may be dead code now that GH
  Actions runs reconstructions).
