<!--
Thanks for contributing a reconstruction method to PReSto!

If this PR registers a NEW reconstruction method, work through the checklist
below. Full instructions: docs/adding-a-reconstruction.md

If this is an ordinary bug fix / feature PR, you can delete the checklist and
just fill in Summary.
-->

## Summary

<!-- What does this PR do and why? -->

## New reconstruction? (delete this section if not)

- **Handle** (canonical id, matches `prestoForm/<handle>/`):
- **Template repo URL** (your repo started from
  [`DaveEdge1/presto-template`](https://github.com/DaveEdge1/presto-template)):
- **Data-only PR?** (yes if `configStrategy: passthrough`, `dedupStrategy: neutral`,
  `runtimeKeyStrategy: none` — i.e. no code edits): yes / no

### Checklist

- [ ] Started from the canonical template
      [`DaveEdge1/presto-template`](https://github.com/DaveEdge1/presto-template)
      and followed its `ADAPTING.md` (it already ships the push-triggered
      `reconstruct.yml`, `config/user_config.yml`, and the LiPD→input scripts).
      Your container reads the
      [PReSto input standard](https://github.com/paleopresto/prestoRecons/blob/main/presto_input_standards.md).
- [ ] Your template repo does **not** commit a `query_params.json` (the server
      commits it on submission; shipping one triggers a default-params run when
      the repo is created from the template).
- [ ] Added `prestoForm/<handle>/` with at least `formIntro.txt`, `configs.yml`,
      and `querypathconfigs.yml` (plus `config_default.yml` + `lookup.json` +
      `translate.js` if the container expects a non-standard config format).
- [ ] Added **one entry** to `presto/reconRegistry.json` (the single source of
      truth — see the field reference in `docs/adding-a-reconstruction.md`).
- [ ] **`ui.category` is `"New methods, in testing"`.** All new methods land
      there; moving to `"Reconstructions"` is a separate, reviewed promotion PR
      (see the Promotion section in `docs/adding-a-reconstruction.md`).
- [ ] Set the three strategy keys. Defaults `configStrategy: "passthrough"`,
      `dedupStrategy: "neutral"`, `runtimeKeyStrategy: "none"` mean **no code edits**.
      If you need a custom value, you also added the matching code branch
      (the only code change a new method should require).
- [ ] Ran `node presto/generateReconLib.js` and committed the regenerated
      `reconLib.json` / `reconsTable.json` / `reconTitles.json`.
- [ ] Generated the parameter-editor form
      (`node jsonEditor/writeQuerypathForm.js <handle>`).
- [ ] `recon_type` is a `VARCHAR` column and the orchestrator auto-migrates on
      startup — **no manual DB step needed**.
- [ ] Tested the end-to-end flow with a real GitHub login: the method appears in
      the picker under **New methods, in testing**, `/query/<handle>` renders, and
      a run completes.

## Screenshots / notes

<!-- Optional: picker + query page showing the new method. -->
