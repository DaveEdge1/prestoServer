# Adding a reconstruction method

PReSto is designed so that a new reconstruction method can be added — in the
common case — **without writing any server code**. Everything the platform needs
to know about a method lives in one file:

> `presto/reconRegistry.json` — the single source of truth.

The query page, the method picker, the GitHub template-repo mapping, the
parameter-editor titles, and the per-method behavior flags are all read from
that registry. Adding a method is therefore usually: **add a folder + add one
registry entry**, then open a pull request (the
[PR template](../.github/PULL_REQUEST_TEMPLATE.md) walks you through it).

## Mental model

```
prestoForm/<handle>/        ← your method's form intro + config schema
presto/reconRegistry.json   ← one entry describing your method (THIS is the source of truth)
<your GitHub template repo>  ← .github/workflows/<handle>.yml that runs your container
```

Run `node presto/generateReconLib.js` after editing the registry to refresh the
derived files (`reconLib.json`, `reconsTable.json`, `reconTitles.json`) that a
few older consumers still read. **Never hand-edit those three files** — edit the
registry and regenerate.

## Steps

### 1. Build a reconstruction container

It must read a params file (yaml or json) and write results to a known
directory, per the
[PReSto input standard](https://github.com/paleopresto/prestoRecons/blob/main/presto_input_standards.md).

### 2. Create a public GitHub template repo

Containing `.github/workflows/<handle>.yml` that checks out the repo, pulls your
container, mounts the params/results dirs, and (optionally) publishes results to
GitHub Pages. Working examples:
[`DaveEdge1/LMR2`](https://github.com/DaveEdge1/LMR2),
[`DaveEdge1/presto-holocene_da`](https://github.com/DaveEdge1/presto-holocene_da),
[`DaveEdge1/lipd-downloads`](https://github.com/DaveEdge1/lipd-downloads).

The server commits these files into a copy of your template before the workflow
runs (which ones depends on the behavior flags below):
`config/user_config.yml` (or your `configPath`), `query_params.json`,
`cleaning_report.json`, `variable_filter.yaml`, and an updated `README.md`.

### 3. Add `prestoForm/<handle>/`

| File | Required? | Purpose |
|------|-----------|---------|
| `formIntro.txt` | yes | Intro text shown above the parameter form |
| `configs.yml` | yes | The standardized PReSto config users edit |
| `config_default.yml` | only if non-standard | Native defaults used for type coercion |
| `lookup.json` | only if non-standard | Maps standardized form keys → your config keys |
| `translate.js` | only if non-standard | Bespoke standard→native translation |

### 4. Add one entry to `presto/reconRegistry.json`

Keyed by your canonical `handle`. Skeleton:

```json
"<handle>": {
  "handle": "<handle>",
  "aliases": [],
  "enabled": true,
  "order": 60,
  "ui": {
    "dropdownLabel": "My Method",
    "title": "My Method",
    "time": "0-2,000 years",
    "proxies": "PAGES 2k proxy database",
    "models": "NA",
    "methods": "My algorithm",
    "doi": "https://doi.org/...",
    "language": "Python"
  },
  "lib": {
    "title": "My Method reconstruction",
    "paramsCon": "/config.yml",
    "resultsDir": "/results",
    "github": "https://github.com/...",
    "conTag": "youruser/yourimage:tag",
    "translate": false,
    "workingParams": ""
  },
  "editorTitle": "My Method Parameters",
  "template": { "owner": "YourGitHub", "name": "your-template-repo" },
  "pageConfig": {
    "defaultMode": "archive",
    "archivedCompilation": { "name": "Pages2kTemperature", "version": "2_2_0" },
    "compilationFilter": "Pages2k",
    "interpVarDefault": "temperature",
    "timeSlider": { "min": -70, "max": 1950, "step": 10 }
  },
  "behavior": {
    "publishesPages": true,
    "dispatch": "push",
    "lipdProcessing": true,
    "commitsQueryParams": true,
    "commitsVariableFilter": true,
    "reconPredicate": null,
    "runtimeHiddenKeys": [],
    "configPath": "config/user_config.yml"
  },
  "dedupStrategy": "neutral",
  "configStrategy": "passthrough",
  "runtimeKeyStrategy": "none"
}
```

#### Field reference

Everything is **pure data** except the three *strategy keys*. Leaving the
strategy keys at their defaults (`passthrough` / `neutral` / `none`) means your
method needs **no server code changes**.

- `handle` — canonical id; must equal the `prestoForm/<handle>/` folder name.
- `aliases` — alternate spellings that resolve to this entry (case-insensitive).
- `enabled` — show in the method picker. `order` — sort position.
- `ui.*` — picker label + comparison-table row (`/forms/recons.json`). Set
  `ui.showInTable: true` to include the method in the homepage comparison table.
  Optional rich fields `proxiesHtml` / `modelsHtml` / `methodsHtml` /
  `publicationHtml` / `timeHtml` may contain `<a>` links and are rendered as HTML
  in that table (falling back to the escaped plain field when absent); the plain
  `proxies` / `models` / `doi` fields stay link-free for other consumers.
- `lib.*` — container tag, params/results paths, the long reconstruction title,
  and method homepage (used in the orchestrator's launch + email text).
- `editorTitle` — heading on the parameter editor page (`null` to omit).
- `template` — your GitHub template repo (`{owner, name}`), or `null`.
- `pageConfig` — defaults for the unified query page (compilation, time slider,
  filters), or `null` if your method doesn't use the query page.
- `behavior.publishesPages` — enable GitHub Pages on the result repo.
- `behavior.dispatch` — `"push"` (workflow triggers on the config commit) or
  `"workflow"` (server dispatches it explicitly).
- `behavior.lipdProcessing` — server prepares LiPD query data before the run.
- `behavior.commitsQueryParams` / `commitsVariableFilter` — which optional input
  files get committed to the result repo.
- `behavior.reconPredicate` — what counts as a "real" proxy for the dedup
  complement (e.g. `{ "unitsEq": "degC" }`), or `null`.
- `behavior.runtimeHiddenKeys` — runtime config keys to hide from the reuse view.
- `behavior.configPath` — where the user config is committed in the result repo.

#### Strategy keys (the only things that may need code)

| Key | Default | Other values | Where the code lives |
|-----|---------|--------------|----------------------|
| `configStrategy` | `passthrough` | `none` (commit no config), `lmr`, `holocene_da` | `services/github.js` `updateRepositoryConfig` |
| `dedupStrategy` | `neutral` | `lmr` (annual-resolution ranking) | `query/public/datacleaningApp.js` |
| `runtimeKeyStrategy` | `none` | `lookupInverse` (invert your `lookup.json`), `lmr` | `routes/reuse.js` |

`passthrough`/`lookupInverse` are reusable by handle — a Holocene-DA-style
method just sets `configStrategy: "holocene_da"` + `runtimeKeyStrategy:
"lookupInverse"` and provides its own `lookup.json` / `config_default.yml`, with
no code change. Adding a *brand-new* strategy value is the only case that
requires editing the files above.

### 5. Regenerate derived files & test

```bash
node presto/generateReconLib.js     # refresh reconLib/reconsTable/reconTitles
node jsonEditor/writeForm.js        # regenerate the parameter editor (if changed)
```

The `reconstruction_jobs.recon_type` column is a `VARCHAR`, so a new method needs
**no schema change**. (On a database created before migration 005, run
`node setup-db.js` once to apply pending migrations.)

Then test end-to-end with a real GitHub account: log in, confirm your method
appears in the picker, fill the form, and watch the workflow run in the repo
created in your account.
