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
- **Template repo URL** (your public GitHub template):
- **Data-only PR?** (yes if `configStrategy: passthrough`, `dedupStrategy: neutral`,
  `runtimeKeyStrategy: none` — i.e. no code edits): yes / no

### Checklist

- [ ] Built/published a reconstruction container that reads the
      [PReSto input standard](https://github.com/paleopresto/prestoRecons/blob/main/presto_input_standards.md).
- [ ] Created a **public** GitHub template repo with `.github/workflows/<handle>.yml`
      (see `DaveEdge1/LMR2`, `DaveEdge1/presto-holocene_da`, `DaveEdge1/lipd-downloads`).
- [ ] Added `prestoForm/<handle>/` with at least `formIntro.txt` and `configs.yml`
      (plus `config_default.yml` + `lookup.json` + `translate.js` if the container
      expects a non-standard config format).
- [ ] Added **one entry** to `presto/reconRegistry.json` (the single source of
      truth — see the field reference in `docs/adding-a-reconstruction.md`).
- [ ] Set the three strategy keys. Defaults `configStrategy: "passthrough"`,
      `dedupStrategy: "neutral"`, `runtimeKeyStrategy: "none"` mean **no code edits**.
      If you need a custom value, you also added the matching code branch
      (the only code change a new method should require).
- [ ] Ran `node presto/generateReconLib.js` and committed the regenerated
      `reconLib.json` / `reconsTable.json` / `reconTitles.json`.
- [ ] Regenerated the parameter editor if needed (`node jsonEditor/writeForm.js`).
- [ ] `recon_type` is a `VARCHAR` column — **no DB migration needed**. (If the
      target DB predates migration 005, run `node setup-db.js`.)
- [ ] Tested the end-to-end flow with a real GitHub login: the method appears in
      the picker, `/query/<handle>` renders, and a run completes.

## Screenshots / notes

<!-- Optional: picker + query page showing the new method. -->
