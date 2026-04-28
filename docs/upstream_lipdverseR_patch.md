# Upstream patch: add primary-proxy columns to `lipdverseQuery.csv`

**Target repo**: [`nickmckay/lipdverseR`](https://github.com/nickmckay/lipdverseR) — `R/queryCsv.R`

## Why

The `lipdverseQuery.csv` export currently preserves 21 columns per TSID. Two
per-column fields that exist on every LiPD column — and that are required
downstream to identify the primary proxy record per dataset — are dropped
during flattening:

1. **`paleoData_useInGlobalTemperatureAnalysis`** — already a flat string column
   after `extractTs` / `ts2tibble`; just needs to be added to the `keeps` list.
2. **`paleoData_inCompilationBeta`** — nested list-of-lists in LiPD, flattened
   by `ts2tibble` into numbered columns
   (`paleoData_inCompilationBeta1_compilationName`,
    `paleoData_inCompilationBeta1_compilationVersion1`,
    `paleoData_inCompilationBeta2_compilationName`, …). These get dropped
   because they aren't in `keeps`. We collapse them into a single
   pipe-joined `inCompilationBeta` column first, following the same pattern
   `interp_Vars` uses (lines 133-137).

Without these columns, downstream consumers (the `presto` data-cleaning
service) cannot identify the primary proxy per dataset without downloading
every `.lpd` individually. The current records-per-dataset ratio for
Pages2kTemperature-2_1_4 is 9.56; after the upstream fix + dataset-first
filtering, the target is ~1.0-1.2.

## Hand-off commands (user to run locally)

The Claude Code sandbox blocks writes to external repos (`nickmckay/lipdverseR`
is outside the trusted scope). Run these four commands on your machine to
apply the patch, push to a fork, and open the PR:

```bash
# 1. Fork + clone (one-time)
gh repo fork nickmckay/lipdverseR --clone --remote
cd lipdverseR

# 2. Create a branch + apply the patch shipped in this repo
git checkout -b add-primary-proxy-columns-to-query-csv
git apply /c/Users/dce25/prestoServer/docs/queryCsv.R.patch

# 3. Commit
git add R/queryCsv.R
git commit -m "queryCsv: add per-TSID useInGlobalTemperatureAnalysis + inCompilationBeta columns

Preserve two per-column LiPD fields that every downstream consumer currently
has to rebuild by downloading full .lpd files:

- paleoData_useInGlobalTemperatureAnalysis (already a flat string after
  ts2tibble — just whitelisted in keeps).
- paleoData_inCompilationBeta (nested list). Flattened into a single
  pipe-joined \"Name-Version|Name-Version\" scalar using the max
  compilationVersion per compilation name per TSID. Mirrors the existing
  interp_Vars / interp_Details flattening pattern."

# 4. Push + open PR
git push -u origin add-primary-proxy-columns-to-query-csv
gh pr create --title "queryCsv: add useInGlobalTemperatureAnalysis + inCompilationBeta columns" --body "$(cat /c/Users/dce25/prestoServer/docs/upstream_pr_body.md)"
```

## Patch summary (what `queryCsv.R.patch` does)

Apply in `R/queryCsv.R` inside `createQueryCsv()`.

### (a) Collapse `paleoData_inCompilationBeta*` into a single string column

Insert after the `interp_Details` block (around line 152), before
`keeps <-` at line 156:

```r
# Collapse paleoData_inCompilationBeta* into a single pipe-joined scalar
# column "Name-Version|Name-Version". Version is the max (most recent)
# compilationVersion listed for that name on the TSID. ts2tibble has already
# flattened the nested list into numbered scalar columns
# paleoData_inCompilationBetaN_compilationName and
# paleoData_inCompilationBetaN_compilationVersionM.
icb_name_cols <- which(stringr::str_detect(
  names(tibdg), "^paleoData_inCompilationBeta\\d+_compilationName$"
))
if (length(icb_name_cols) > 0) {
  tibdg$inCompilationBeta <- apply(tibdg, 1, function(row) {
    parts <- character()
    for (ni in icb_name_cols) {
      nm <- row[[ni]]
      if (is.na(nm) || nm == "" || nm == "NA") next
      idx <- stringr::str_extract(names(tibdg)[ni], "\\d+")
      vcols <- which(stringr::str_detect(
        names(tibdg),
        paste0("^paleoData_inCompilationBeta", idx, "_compilationVersion\\d+$")
      ))
      vers <- unlist(row[vcols])
      vers <- vers[!is.na(vers) & vers != "" & vers != "NA"]
      if (length(vers) == 0) {
        parts <- c(parts, nm)
      } else {
        parts <- c(parts, paste0(nm, "-", max(vers)))
      }
    }
    paste(parts, collapse = "|")
  })
} else {
  tibdg$inCompilationBeta <- ""
}
```

### (b) Extend the `keeps` list

At line 156-160, add two entries:

```r
keeps <- c("paleoData_TSid","archiveType", "paleoData_variableName", "paleoData_units","paleoData_proxy",
           "geo_latitude", "geo_longitude","geo_elevation", "minAge", "maxAge",
           "medianResolution", "auth", "datasetId", "dataSetName","country",
           "continent", "interp_Vars", "interp_Details",
           "paleoData_mostRecentCompilations", "interpretation1_seasonality","paleoData_hasTimeTsid",
           "paleoData_useInGlobalTemperatureAnalysis",
           "inCompilationBeta")
```

The `keeps <- intersect(keeps, names(tibdg))` at line 163 stays as a safety
net — datasets without `useInGlobalTemperatureAnalysis` (most non-Pages2k)
will simply have that column absent in the final tibble rather than
erroring.

## Verification after the PR lands

After rebuilding `lipdverseQuery.csv`, confirm the header carries both new
columns:

```bash
curl -sS https://lipdverse.org/lipdverse/lipdverseQuery.zip \
  | zcat | head -1 | tr ',' '\n' | grep -E 'useInGlobal|inCompilationBeta'
# expect two matches
```

Confirm `useInGlobalTemperatureAnalysis` is populated for Pages2k:

```sql
SELECT COUNT(*) records, COUNT(DISTINCT dataSetName) datasets
FROM query
WHERE paleoData_mostRecentCompilations LIKE '%Pages2kTemperature-2_1_4%'
  AND paleoData_useInGlobalTemperatureAnalysis = 'TRUE';
-- target: ~228 records, ~228 datasets (1:1)
```

Confirm `inCompilationBeta` shape:

```sql
SELECT inCompilationBeta FROM query
WHERE paleoData_TSid IN ('Africa_003', 'Arc_012')
LIMIT 5;
-- expect strings like "Pages2kTemperature-2_1_4|Temp12k-0_8_0"
```

## Notes for the reviewer

- The new flattening block uses the same `apply(tibdg, 1, …)` row-wise
  pattern already used for `auth` (line 129) and `interp_Vars` (line 135).
  No new dependencies.
- `max(vers)` operates on semver-ish string versions like `"2_1_4"`,
  `"2_2_0"`. Lexicographic ordering is correct for `N_N_N` strings with
  consistent component widths — the convention lipdverse uses. If a future
  compilation adopts `N_NN_N` widths, swap for a tuple-aware comparator.
- **Alternative encoding** — if preserving the full version history per
  compilation matters more than cell compactness, replace `max(vers)` with
  `paste(sort(vers), collapse=",")` so the cell becomes
  `"Pages2kTemperature-2_1_1,2_1_2,2_1_4,2_2_0|Temp12k-0_8_0"`. Downstream
  code handles either form via the same `str_detect` / `LIKE` queries.
- `paleoData_useInGlobalTemperatureAnalysis` is populated only by
  Pages2k-family compilations; for CoralHydro2k, SISAL, Temp12k, etc. it's
  absent and the column will be all-NA. That's expected — downstream code
  uses `inCompilationBeta` (max-version-per-family rule) as a parallel
  primary-proxy signal.
- Once this merges, downstream `presto` installations can drop their local
  per-dataset `.lpd` enrichment step (`scripts/updatePrimaryProxyColumns.js`)
  — ~15 min nightly savings per deployment.
