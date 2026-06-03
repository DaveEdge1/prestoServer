# Parameter interactions: reconstruction window, anomaly reference period, prior window

This document describes how three user-facing reconstruction parameters interact in
`da_main_code.py` / `da_load_models.get_indices_for_prior`, and which combinations
should be constrained, warned, or surfaced as diagnostics in the configuration GUI.

## Parameters

| GUI label | Config key | Type | Meaning |
|---|---|---|---|
| Reconstruction window | `age_range_to_reconstruct` | `[recent_BP, old_BP]` | Range of ages to reconstruct. Drives the binned `age_centers` the DA loop iterates over (bin width = `time_resolution`). |
| Anomaly reference period | `reference_period` | `[recent_BP, old_BP]` | Used only when `reconstruction_type == 'relative'`. The model `tas` is centered by subtracting its mean over this period, per model. |
| Prior window | `prior_window` | int years, or `'all'` | Symmetric ± window/2 box around each reconstruction age. Selects which model time slices populate the prior for that age. |

Two related parameters are read-only / model-determined and bound the user inputs:

- **`age_range_model`** — fixed by the loaded model NetCDFs. For the bundled
  `hadcm3_regrid` / `trace_regrid` files this is approximately 21999 BP → 0 BP.
- **`time_resolution`** — selected separately by the user. Defines the bin width
  for `age_centers` and a `time_resolution/2` buffer at the edges of the
  model age range when computing prior bounds.

## How prior selection works

`da_load_models.get_indices_for_prior(options, model_data, age)`:

```python
prior_age_bound_recent = min(age_model[valid_inds]) - time_resolution/2
prior_age_bound_old    = max(age_model[valid_inds]) + time_resolution/2

if prior_window == 'all':
    window = [prior_age_bound_recent, prior_age_bound_old]
else:
    window = [age - prior_window/2, age + prior_window/2]
    # If the window falls off the recent edge, slide it inward keeping its width:
    if window[0] < prior_age_bound_recent:
        window = [prior_age_bound_recent, prior_age_bound_recent + prior_window]
    elif window[1] > prior_age_bound_old:
        window = [prior_age_bound_old - prior_window, prior_age_bound_old]

indices = where((age_model > window[0]) & (age_model <= window[1]) & valid_inds)
```

Two consequences worth knowing:

1. **The window slides instead of clipping.** If a user specifies `prior_window`
   larger than the model's age span, the slide rule still produces a valid
   range covering essentially all valid slices — the result is a *static prior*
   identical at every reconstruction age. The DA loop runs without error, but
   the time-varying-prior feature is silently disabled.
2. **`valid_inds` excludes a `maximum_resolution/2` buffer near the model edges.**
   A reconstruction age very close to the model edge can return zero indices
   even if the requested window is well-formed.

## How the reference period is applied

Only for `reconstruction_type == 'relative'`, in `da_main_code.py:62–67`:

```python
for each model i:
    ind_for_model = (model_data['number'] == i+1)
    ind_ref       = (age >= reference_period[0]) & (age < reference_period[1]) & ind_for_model
    tas[ind_for_model]        -= mean(tas[ind_ref], axis=0)
    tas_annual[ind_for_model] -= mean(tas_annual[ind_ref], axis=0)
```

If `ind_ref` is empty for any model, `np.mean` of an empty slice returns NaN
**without raising**, and the entire `tas` array for that model becomes NaN.
The reconstruction completes and writes an all-NaN NetCDF.

## How `n_ens_possible` is determined

The DA loop assumes a fixed ensemble size across ages. After the recent patch
in `da_main_code.py:107–130`:

```python
prior_counts = [len(get_indices_for_prior(options, model_data, age))
                for age in age_centers]
n_ens_possible = min(prior_counts)
if n_ens_possible == 0:
    raise RuntimeError(...)  # at least one age has no prior states
```

Per-age priors longer than this minimum are deterministically subsampled
(`np.random.default_rng(seed_for_prior + age_counter)`) down to `n_ens_possible`.

## Failure modes

| # | Combination | Effect | Severity |
|---|---|---|---|
| 1 | `reference_period` does not overlap `age_range_model` (or any model's coverage) | `np.mean` over empty → NaN → entire model `tas` becomes NaN → reconstruction completes and writes all-NaN output | **Silent corruption** |
| 2 | `age_range_to_reconstruct` extends outside `age_range_model` | At least one `age_center` returns 0 prior indices → `RuntimeError` from the n_ens_possible patch | Hard fail (clear error) |
| 3 | `age_range_to_reconstruct` partially overlaps `age_range_model` | A few edge ages clamp `n_ens_possible` to a small minimum; ensemble for *all* ages is subsampled to that count | Quality regression (logged but not fatal) |
| 4 | `prior_window` ≥ span of `age_range_model` | Slide rule collapses to a static prior; time-varying behaviour disabled | **Silent methodological** |
| 5 | `prior_window < time_resolution` | Some ages may get 0 or 1 slices; if 0, RuntimeError; if low, EnKF poorly conditioned | Hard fail or quality drop |
| 6 | `prior_window < 2 × time_resolution` | Possible but very small per-age priors (often <30 members) → high sampling noise, EnKF instability | Quality |
| 7 | `reference_period` not contained in `age_range_to_reconstruct` | Anomalies defined against a period the user cannot see in their output | UX / interpretability |
| 8 | `reference_period` overlaps `prior_window` heavily for nearby ages (relative mode) | Same model slices that set the anomaly baseline also populate the prior — mild circularity | Methodological |
| 9 | `time_resolution > (age_range_to_reconstruct[1] - age_range_to_reconstruct[0])` | Zero `age_centers` → cryptic shape error in array allocation | Hard fail (poor UX) |
| 10 | `time_resolution` not in the pre-processed set `{10, 20, 50, 100, 200, 500, 1000}` | Workflow falls back to downloading raw model data from Zenodo and processing in-container — works but slow | Performance |

## Recommended GUI behaviour

### Hard constraints (block submission)

These produce silent NaN output or cryptic crashes — they should never reach the runner.

- `reference_period[0] ≥ age_range_model[0]` **and** `reference_period[1] ≤ age_range_model[1]`
  (only when `reconstruction_type == 'relative'`).
- `age_range_to_reconstruct[0] ≥ age_range_model[0]` **and** `age_range_to_reconstruct[1] ≤ age_range_model[1]`.
- `age_range_to_reconstruct[1] > age_range_to_reconstruct[0]` (non-empty range).
- `reference_period[1] > reference_period[0]` (non-empty range, when applicable).
- `time_resolution ≤ (age_range_to_reconstruct[1] - age_range_to_reconstruct[0])`.
- `prior_window > 0` (or the literal string `'all'`).
- (only when `reconstruction_type == 'relative'`) `reference_period` fully
  contained in `age_range_to_reconstruct` — the time interval for
  reconstruction must fully cover the time interval for anomaly calculation.
  (Promoted from soft to hard: anomalies defined against a period outside the
  reconstruction window are uninterpretable to the user.)

### Soft constraints (warn, allow override)

- `prior_window > (age_range_model[1] - age_range_model[0])` → "Prior window
  exceeds the model's age span; the prior will be effectively static across
  all reconstruction ages."
- `prior_window < 2 × time_resolution` → "Per-age prior may contain very few
  ensemble members; reconstructions can become noisy or unstable."

### Live diagnostics (informational, recompute on every change)

Show the user what their settings imply *before* they submit:

- **Estimated reconstruction ages**: number of bins =
  `floor((age_range_to_reconstruct[1] - age_range_to_reconstruct[0]) / time_resolution)`.
- **Estimated `n_ens_possible`** at a representative interior age:
  approximately `prior_window / model_time_step × n_models_in_prior`
  (model time step is 10 yr for the standard pre-processed model files).
  Flag if this falls below ~30; below ~10 will likely be unusable.
- **Whether the reference period is fully covered by the prior models** —
  if any model's `age_range_model` does not contain `reference_period`,
  warn that the reference mean for that model will be NaN.

### Why these guards matter

Failure mode 1 (reference period outside model range) is the highest priority
because it produces a *complete-looking* NetCDF with all-NaN data — the user
typically discovers this by opening the file or running the validation
notebook, after burning a full DA run on the CI runner. Adding a single
front-end check eliminates an entire class of wasted runs.

Failure mode 4 (oversized prior window) is the second priority because it
misleads the user about what they are running — the methodological
distinction between a time-varying and a static prior is the entire point
of the per-age `prior_window` parameter.
