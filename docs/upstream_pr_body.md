## Summary

Preserve two per-column LiPD fields that every downstream consumer of
`lipdverseQuery.csv` currently has to reconstruct by downloading every
`.lpd` file individually:

- **`paleoData_useInGlobalTemperatureAnalysis`** — already a flat string
  column after `extractTs` / `ts2tibble`; just added to the `keeps`
  whitelist.
- **`paleoData_inCompilationBeta`** — nested list-of-lists that
  `ts2tibble` flattens into numbered scalar columns. Collapsed into a
  single pipe-joined `inCompilationBeta` column of the form
  `"Name-Version|Name-Version"`, using the max (most recent)
  `compilationVersion` per compilation name per TSID. Mirrors the
  existing `interp_Vars` / `interp_Details` flattening pattern
  (`R/queryCsv.R` lines 133-151).

## Motivation

Downstream `presto` data-cleaning needs to pick one (or a few) canonical
primary-proxy records per LiPD dataset. Both fields are already per-column
in the raw LiPD schema, but the current CSV export only keeps
dataset-level summaries of compilation membership (`paleoData_mostRecentCompilations`)
and drops `useInGlobalTemperatureAnalysis` entirely. Rebuilding them by
downloading every `.lpd` takes ~15 minutes across the full corpus; the
two new columns let downstream consumers identify primaries with a single
SQL query.

Spot-check on Pages2kTemperature-2_1_4:
- `paleoData_useInGlobalTemperatureAnalysis='TRUE'` → 228 records across
  228 datasets (1:1, matches compilation curation).
- `inCompilationBeta LIKE '%Pages2kTemperature-2_2_0%'` → returns the
  same primary set via the max-version-per-family rule, even for legacy
  query results.

## Implementation notes

- **Row-wise `apply`**: matches the existing `auth` (line 129) and
  `interp_Vars` (line 135) patterns. No new dependencies.
- **`max(vers)`** uses lexicographic ordering on `N_N_N` version strings;
  correct as long as component widths stay consistent (the current
  convention across lipdverse). If a future compilation adopts mixed
  widths (e.g. `N_NN_N`), swap for a tuple-aware comparator.
- The `keeps <- intersect(keeps, names(tibdg))` safety net at line 163
  handles datasets that lack either field (most non-Pages2k records have
  no `useInGlobalTemperatureAnalysis`) without erroring — the column is
  simply absent in those rows' output.

## Test plan

- [ ] `devtools::load_all()`
- [ ] Build `lipdverseQuery.csv` on a test corpus
- [ ] `head -1 lipdverseQuery.csv | tr ',' '\n' | grep -E 'useInGlobal|inCompilationBeta'` — expect two matches
- [ ] Verify shape: `grep -oE '[^,]*Pages2kTemperature[^,|]*\|[^,]*' lipdverseQuery.csv | head` should show pipe-joined memberships
- [ ] Confirm older rows with no `inCompilationBeta` list come through as empty string, not NA

## Alternative encoding considered

Full version history per compilation (`"Name-v1,v2,v3|Name-v1"`) was
considered — it would let downstream code answer "was this TSID ever in
Pages2k v2.1.2?". I went with the max-version form because:
1. Cells stay compact (~30 chars vs 100+).
2. Downstream consumers overwhelmingly want "is this TSID in the latest
   curation?", which max-version encodes natively.
3. Full history is still available in the source `.lpd` files for the
   rare consumer that needs it.

Happy to switch to `paste(sort(vers), collapse=",")` if you'd prefer full
fidelity — the column consumers on our end can handle either form.
