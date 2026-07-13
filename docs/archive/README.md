# Archived documentation

These files are **historical** — they describe planning, migration, or
implementation-status states that no longer match the current system. They are
kept for provenance, not as guidance. Do not follow their instructions.

For current documentation, see the repo `README.md` and the live docs under
`docs/` (deployment runbooks, `adding-a-reconstruction.md`,
`presto_input_standards.md`, testing guides).

| File | What it was | Superseded by |
|------|-------------|---------------|
| `CONTAINERIZATION_PLAN.md` | Plan to containerize the old 9-server stack | Consolidation done — single Express app (`app.js`) |
| `FRONTEND_MIGRATION.md` | URL rewrite from per-server ports to relative paths | Migration complete |
| `LMR_implementation.md` | Original 10-phase LMR integration plan | LMR shipped; registry-driven flow |
| `LMR_IMPLEMENTATION_STATUS.md` | LMR "implementation complete" checklist | Same as above |
| `LMR_READY_FOR_TESTING.md` | LMR testing quickstart (subset of the status file) | Same as above |
| `MODIFY_LIPDVERSER.md` | Early lipdverseR `updateSqlQuery()` patch notes | `docs/upstream_lipdverseR_patch.md` |
| `OAUTH_TEST_INSTRUCTIONS.md` | Local OAuth test walkthrough (secrets scrubbed) | Current OAuth flow in `routes/oauth.js` |
| `production-deployment.md` | Early deploy notes; manual GitHub-UI workflow edits | `docs/production-runbook.md`, `docs/digitalocean-runbook.md` |
| `BayGMST_plan.md` | BayGMST method planning doc | BayGMST method now implemented |

> Note: several of these reference `prestoGo.js` / `prestoServer.js` (the old
> standalone reconstruction runners) and hand-edited `reconLib.json` — both
> obsolete. Reconstructions now run on GitHub Actions in the user's fork, and
> `reconLib.json` is generated from `presto/reconRegistry.json`.
