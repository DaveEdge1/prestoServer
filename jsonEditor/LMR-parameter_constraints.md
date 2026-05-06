# Parameter interactions: reconstruction window, prior anomaly period, ensemble & assimilation knobs

This document describes how the user-facing parameters in
`lmr_configs.yml` interact in `scripts/cfr_main_code.py` (the cfr-based
LMR driver in [DaveEdge1/LMR2](https://github.com/DaveEdge1/LMR2)) and
which combinations should be constrained, warned, or surfaced as
diagnostics in the configuration GUI (`forms-query/LMR.html`).

## Parameters

| GUI label | Config key | Type | Meaning |
|---|---|---|---|
| Reconstruction Period | `recon_period` | `[start_yr, end_yr]` CE | Years (inclusive) the DA loop assimilates over. Drives the chunked outer loop in `cfr_main_code.py:150–151` (`CHUNK_YEARS=500` per chunk). |
| Monte Carlo Random Seeds | `recon_seeds` | list of ints (or count) | Each seed runs an independent `split_proxydb` + `run_da` pass producing one realization. Final reconstruction is the mean across seeds. |
| Localization Radius (km) | `recon_loc_rad` | int km | Gaspari–Cohn localization radius for proxy influence. Larger ⇒ more distant proxies contribute. |
| Fraction of Proxies to Assimilate | `assim_frac` | float ∈ [0, 1] | Per-seed split: fraction assimilated, the rest reserved for held-out validation. |
| Ensemble Size | `nens` | int | Prior ensemble members per DA cycle. Auto-batched above `NENS_BATCH=100` by expanding `recon_seeds` so total members stay constant. |
| Seasonality of Reconstruction | `prior_annualize_months` | list of ints in `[-12..-1, 1..12]` | Months averaged when reducing the monthly prior to the assimilation timestep. Negative values reference the prior calendar year (used for DJF/winter). |
| Prior Anomaly Period | `prior_anom_period` | `[start_yr, end_yr]` CE | Period over which the prior fields are mean-centered before assimilation. |

Also relevant but not user-facing:

- **`filter_proxydb_kwargs`** — proxy whitelist by `ptype` (or archive). Records outside the keys list are dropped at load time.
- **`min_proxies_for_recon`** — `cfr_main_code.py:99` (default 10). Auto-trims `recon_period[0]` forward to the first year where ≥ this many proxies have data. Without trimming, early years return a flat prior-mean reconstruction.
- **Script constants**: `NENS_BATCH=100`, `CHUNK_YEARS=500`, `MIN_R=0.01` (R-floor on `PSMmse` to prevent Kalman-gain blowup).
- **Prior data**: CCSM4 Last Millennium, **850–1850 CE only**. This is the model's full coverage — the upper limit of `prior_anom_period` and the prior pool both bottom out here.
- **Instrumental data** (used for PSM calibration and validation): GISTEMP (1880–) and HadCRUT5 (1850–).

## How the prior is built

`job_cfg.prep_da_cfg(...)` (cfr) runs once before the DA loop:

1. Downloads the CCSM4 LM monthly fields (`tas`, `pr`).
2. Annualizes by averaging months listed in `prior_annualize_months`. Negative entries pull from the previous calendar year (e.g., `[-12, 1, 2]` ⇒ DJF where Dec is from year *t*−1).
3. Computes the prior anomaly by subtracting the mean over `prior_anom_period` per grid cell.
4. Calibrates a Linear PSM (or Bilinear for trees) per record against instrumental data. Records without enough instrumental overlap are dropped.

The annualized, anomaly-centered prior is the ensemble pool that `run_da` samples from at every reconstruction year. Critically, the LMR2 driver passes `trim_prior=False` (`cfr_main_code.py:176`) — the pool is **not** restricted to years inside the current chunk. Every recon year (including those outside 850–1850) draws from the same fixed pool. This is the standard offline-LMR design.

## How the DA loop runs

`cfr_main_code.py:157–216`, per seed:

```python
job_cfg.split_proxydb(seed=seed, assim_frac=assim_frac)
for c_start, c_end in chunks:                # chunks of CHUNK_YEARS=500
    job_cfg.run_da(
        recon_period=[c_start, c_end],
        recon_loc_rad=recon_loc_rad,
        nens=nens,
        seed=seed,
        trim_prior=False,
    )
    job_cfg.save_recon(chunk_path, ...)
# concat chunks → job_r{seed:02d}_recon.nc
```

Three behaviors worth knowing:

1. **Same proxy split every chunk**: `split_proxydb` runs once per seed, before chunking. A proxy assigned to "assim" stays assim for all chunks of that seed.
2. **Auto-batch silently rewrites `recon_seeds`**: when `nens > NENS_BATCH`, the script computes `n_batches = ceil(nens / 100)` and synthesizes extra seeds via `s + b * max_seed`. This formula is **not collision-free**: with `recon_seeds=[0,1,2]` and `nens=200` you get `[0,1,2,2,3,4]` (duplicate 2). Duplicate seeds run identical realizations and are wasted compute (and slightly bias the final mean). See failure mode 13.
3. **Auto-trim of `recon_period[0]`**: `cfr_main_code.py:115–127`. Years before the first year with `>= min_proxies` proxies are silently removed from `recon_period`. The user sees only a log line.

## How `prior_anom_period` is applied

cfr subtracts the time-mean over `prior_anom_period` from the prior fields, per grid cell. If the period falls **outside** the prior model's 850–1850 CE coverage:

- Empty intersection ⇒ the mean is taken over zero samples ⇒ NaN ⇒ the entire prior becomes NaN ⇒ DA produces all-NaN output. cfr's behavior here is consistent with `numpy.mean` on an empty slice (warning, not error).
- Partial overlap (e.g., `[1700, 2000]` with model coverage 850–1850) ⇒ the mean is computed over the overlap (1700–1850). The recon completes, but the anomaly baseline is shifted relative to what the user expects.

## Failure modes

| # | Combination | Effect | Severity |
|---|---|---|---|
| 1 | `prior_anom_period` does not overlap `[850, 1850]` (CCSM4 LM coverage) | Prior anomaly mean is taken over an empty slice ⇒ NaN ⇒ all-NaN reconstruction. Run completes, validation page renders empty plots. | **Silent corruption** |
| 2 | `recon_period[1] < recon_period[0]` | `chunk_starts` is empty ⇒ no `run_da` call ⇒ no output file written. Workflow's "Verify reconstruction results" step fails with "No reconstruction results generated", but the cause is cryptic. | Hard fail (poor UX) |
| 3 | `recon_period[0] == recon_period[1]` | Single-year reconstruction. Runs but the validation page's CE/R metrics need >1 timestep — division-by-zero on variance computations. | Hard fail downstream |
| 4 | `recon_period` does not intersect `[1880, 2000]` (GISTEMP/HadCRUT5 validation window) | Reconstruction completes, but `validate_recon.py`'s instrumental-validation block has no overlap to compute CE/R against. The "GMST Validation Metrics" table is empty or NaN. | Quality / validation |
| 5 | `recon_period` extends well outside `[850, 1850]` (prior coverage) | Years outside the prior pool still run (because `trim_prior=False`), but their reconstructions are drawn from the **same** 850–1850 prior pool. Methodologically this is "what LMR does", but a user reconstructing 0–500 CE may not realize the prior is built from a much later climate state. | **Silent methodological** |
| 6 | `prior_annualize_months` is empty | cfr's annualize step averages over zero months ⇒ NaN prior fields ⇒ all-NaN output. Same shape as failure 1. | **Silent corruption** |
| 7 | `prior_annualize_months` contains only negative months | Valid (would mean an "all prior-year" seasonality), but offsets the entire annual mean by a year, which is rarely the user's intent. | UX / interpretability |
| 8 | `prior_annualize_months` contains 0 or values outside `[-12..-1, 1..12]` | cfr raises an indexing error during annualization. | Hard fail |
| 9 | `assim_frac == 0` | `split_proxydb` puts all records in the eval set; nothing assimilated. Reconstruction = prior mean at every year. Validation page shows perfect held-out CE because the "recon" never moved. | **Silent methodological** |
| 10 | `assim_frac == 1` | All records assimilated, none held out. Validation page's held-out metrics are undefined; the "Spatial CE vs GISTEMP" panel still renders against instrumental data but the proxy-vs-recon comparison block in the comparison section becomes meaningless. | Quality / validation |
| 11 | `nens == 1` | Ensemble has no spread ⇒ EnKF gain degenerates (zero background variance) ⇒ analysis = first guess. cfr may raise or silently produce flat output. | Hard fail or silent |
| 12 | `nens` very small (≈ 2–10) | EnKF poorly conditioned, large sampling noise, spurious long-range correlations dominate without strong localization. | Quality |
| 13 | `nens > NENS_BATCH` with `len(recon_seeds) > max(recon_seeds)` | Auto-batch seed expansion `[s + b * max_seed]` produces duplicate seeds. Duplicates are wasted compute and slightly under-represent the realization spread in the final mean. Example: `recon_seeds=[0,1,2]`, `nens=200` ⇒ effective seeds `[0,1,2,2,3,4]`. | Code bug (silent) |
| 14 | `recon_loc_rad` ≤ 0 | cfr treats this as a degenerate Gaspari–Cohn radius. Behavior depends on the exact value: `0` typically disables localization (full coupling), negative values may raise. | Hard fail or silent |
| 15 | `recon_loc_rad` smaller than the prior grid spacing (~300–500 km for CCSM4 regrid) | Each grid cell sees only its closest proxies; most of the network has zero weight. Reconstruction is very noisy and resembles a kriging interpolation more than DA. | Quality |
| 16 | `recon_loc_rad` ≫ Earth half-circumference (≈ 20,000 km) | Localization is effectively disabled. Distant proxies pull on every grid cell. Spurious long-range correlations propagate. (Default 25,000 km is already in this regime.) | Quality / methodological |
| 17 | `filter_proxydb_kwargs.keys` empty or no intersection with the loaded ptypes | All records dropped ⇒ `run_da` with zero observations ⇒ cfr raises during DA setup. | Hard fail |
| 18 | `min_proxies_for_recon` higher than the maximum yearly proxy count | Auto-trim's "no year qualifies" branch fires (`cfr_main_code.py:117–119`) and the full configured `recon_period` is kept. Early years still run with too-few proxies and produce flat output for that span. | Quality / interpretability |
| 19 | `prior_anom_period` not contained in `recon_period` | Anomalies defined relative to a period the user cannot inspect in their output time series. Same pattern as Holocene failure 7. | UX / interpretability |
| 20 | `prior_anom_period` overlaps the held-out validation window `[1880, 2000]` | The model's "zero" is set against a period that includes the instrumental era ⇒ recon anomalies in the validation window are biased toward zero, depressing CE. | Methodological |
| 21 | `recon_seeds` length × `nens` × `recon_period` span produces a huge run | No hard cap. A 1000-member, 50-seed, 0–2020 run is ~70 GB of NetCDF + tens of CPU-hours. The free-tier runner times out at 240 minutes per `reconstruct` job (`cfr-custom.yml:202`). | Performance / runner-timeout |

## Recommended GUI behaviour

### Hard constraints (block submission)

These produce silent NaN output, cryptic crashes, or no-output runs — they should never reach the runner.

- `recon_period[1] > recon_period[0]` (non-empty range; ideally `>= 2` for variance computations downstream).
- `prior_anom_period[1] > prior_anom_period[0]` (non-empty range).
- `prior_anom_period[0] >= 850` and `prior_anom_period[1] <= 1850` (must be inside CCSM4 LM coverage). The current GUI slider allows up to year 2000 — this is the highest-priority guard to add.
- `prior_annualize_months` non-empty and every element in `[-12..-1] ∪ [1..12]`.
- `filter_proxydb_kwargs.keys` non-empty (already enforced upstream by the data-cleaning app, but worth a final check).
- `nens >= 10` (below this the EnKF is essentially unusable; the slider already enforces this).
- `0 < recon_loc_rad <= 40000` (positive and physically meaningful; the slider's 1000–100000 range is fine for the upper bound but a 1000 km lower bound is generous).
- `assim_frac >= 0.05` (or similar) — `assim_frac=0` produces a prior-only "reconstruction".
- `assim_frac <= 0.95` — leave at least some records for held-out validation.

### Soft constraints (warn, allow override)

- `recon_period` extends outside `[850, 1850]` ⇒ "Years outside 850–1850 CE will be reconstructed against a prior pool drawn from CCSM4's Last Millennium simulation. The reconstructed climate state in those years is conditioned on a fixed prior representative of 850–1850 — interpret long-extension recons (e.g., 0–500 CE or 1900–2020) accordingly."
- `recon_period` does not overlap `[1880, 2000]` ⇒ "The validation page's GMST CE/R metrics require overlap with GISTEMP/HadCRUT5 (1880–2000). Without it, the validation block will be empty."
- `prior_anom_period` overlaps `[1880, 2000]` heavily ⇒ "Prior anomaly baseline overlaps the validation window; reconstructed anomalies in 1880–2000 will be biased toward zero relative to the instrumental record, depressing CE."
- `prior_anom_period` not contained in `recon_period` ⇒ "Anomalies are defined relative to a period outside your reconstruction window." (Same as Holocene's recommendation.)
- `recon_loc_rad < 5000` km ⇒ "Localization radius is shorter than typical synoptic correlation scales (~5000 km); many grid cells will see only their nearest proxies."
- `recon_loc_rad > 20000` km ⇒ "Localization is effectively global; distant proxies will pull on every grid cell. The standard LMR v2.1 default is 25,000 km; values above this are unconventional."
- `nens < 50` ⇒ "Small ensembles produce poorly conditioned EnKF analyses; LMR v2.1 used 100."
- `nens * len(recon_seeds) * (recon_period_span)` × per-year runtime estimate > 240 min ⇒ "Estimated runtime exceeds the 4-hour runner cap; consider reducing seeds or `nens`."
- `recon_seeds` count > 20 with `nens > 100` ⇒ "Auto-batching will multiply your seed count further; total realization count may be much larger than expected." (And: fix the underlying duplicate-seed bug; see code bug below.)

### Live diagnostics (recompute on every change)

- **Estimated total ensemble size**: `nens × n_realizations`, where `n_realizations` is `len(recon_seeds)` if `nens <= NENS_BATCH`, else `len(recon_seeds) * ceil(nens / NENS_BATCH)`. Show this prominently — users routinely want a "1000-member" recon.
- **Estimated runtime**: rough heuristic `~ 0.05 × nens × len(seeds) × (end - start) / 60` minutes on the free runner. Flag red above 200 min.
- **Prior pool coverage hint**: if `recon_period` extends beyond `[850, 1850]`, show a small inline note "*N* of the *M* requested years are outside the CCSM4 prior coverage — those will be reconstructed against the same 850–1850 pool".
- **Validation overlap**: number of years in `recon_period ∩ [1880, 2000]`. Flag if zero.
- **Anomaly baseline check**: visually highlight where `prior_anom_period` falls inside `[850, 1850]` (allowed) vs outside (will silently produce NaN — should be a hard fail).

### Code-level fixes (out of scope for the GUI but worth tracking)

These are not config-conflict guards but are issues the audit surfaced that the GUI cannot fix:

- **Auto-batch seed collision** (failure 13): replace `s + b * max_seed` with `max_seed + 1 + b * len(seeds) + i` (or any monotone collision-free generator). Affects any custom recon with `nens > 100` and non-trivial `recon_seeds`.
- **Empty-recon-period silent skip** (failure 2): the chunking loop should raise a clear error when `recon_period[1] < recon_period[0]`, rather than producing no chunks and letting the workflow's "Verify reconstruction results" fail with a generic message.

## Why these guards matter

Failure mode **1** (`prior_anom_period` outside CCSM4 coverage) is the highest priority because it silently produces an all-NaN NetCDF — same failure shape as the Holocene reference period mismatch. Today's GUI slider allows year 2000 as the upper bound, so a user who intuitively picks "modern" as their anomaly baseline will get an empty recon with no error. A single front-end check (clamp `prior_anom_period` to `[850, 1850]`) eliminates this entire class of wasted runs.

Failure mode **5** (recon outside prior coverage) is the second priority because it is the LMR analogue of Holocene's static-prior failure: the user thinks they have a time-varying prior over the full recon window, but in fact every year is conditioned on the same fixed 850–1850 ensemble pool. This is methodologically defensible (it *is* how offline LMR works) but it should be surfaced — especially for recons that extend deep into the Holocene or far past 1850.

Failure mode **13** (auto-batch seed collisions) is the highest-priority *code* fix even though it is invisible to the GUI: it silently degrades realizations whenever `nens > 100` with multiple seeds. Easy to fix, no user-facing cost.
