// Live constraint validation + diagnostics for the LMR editor form.
// See jsonEditor/LMR-parameter_constraints.md for failure-mode rationale.
(function () {
  'use strict';

  const PRIOR_COVERAGE = [850, 1850];      // CCSM4 LM coverage
  const VALIDATION_WINDOW = [1880, 2000];  // GISTEMP/HadCRUT5 overlap
  const LOC_RAD_MAX = 40000;               // km, hard cap (failure 16)
  const LOC_RAD_LOW = 5000;                // km, soft floor (failure 15)
  const LOC_RAD_HIGH = 20000;              // km, soft ceiling
  const NENS_BATCH = 100;                  // matches cfr_main_code.py
  const NENS_SOFT_MIN = 50;
  const ASSIM_FRAC_MIN = 0.05;
  const ASSIM_FRAC_MAX = 0.95;
  const VALID_MONTHS = new Set([
    -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1,
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12
  ]);

  function num(el) {
    if (!el) return NaN;
    return Number(el.value);
  }

  function rangePair(prefix) {
    return [
      num(document.getElementById(prefix + '_fromInput')),
      num(document.getElementById(prefix + '_toInput'))
    ];
  }

  function readForm() {
    const months = Array.from(
      document.querySelectorAll('input[name="prior_annualize_months"]:checked')
    ).map(function (el) { return Number(el.value); });
    return {
      reconPeriod: rangePair('recon_period'),
      priorAnomPeriod: rangePair('prior_anom_period'),
      reconSeeds: num(document.getElementById('recon_seedsInput')),
      reconLocRad: num(document.getElementById('recon_loc_radInput')),
      assimFrac: num(document.getElementById('proxy_assim_fracInput')),
      nens: num(document.getElementById('proxy_nensInput')),
      months: months
    };
  }

  function intersectLength(a, b) {
    const lo = Math.max(a[0], b[0]);
    const hi = Math.min(a[1], b[1]);
    return Math.max(0, hi - lo);
  }

  function contains(outer, inner) {
    return inner[0] >= outer[0] && inner[1] <= outer[1];
  }

  function evaluate(s) {
    const errors = [];
    const warnings = [];

    // ─── Hard errors ─────────────────────────────────────────────────────
    if (!(s.reconPeriod[1] - s.reconPeriod[0] >= 2)) {
      errors.push('Reconstruction period must span at least 2 years (max > min).');
    }
    if (!(s.priorAnomPeriod[1] > s.priorAnomPeriod[0])) {
      errors.push('Prior anomaly period max must be greater than min.');
    }
    if (s.priorAnomPeriod[0] < PRIOR_COVERAGE[0] || s.priorAnomPeriod[1] > PRIOR_COVERAGE[1]) {
      errors.push(
        'Prior anomaly period must lie within [' + PRIOR_COVERAGE[0] + ', ' + PRIOR_COVERAGE[1] +
        '] CE (CCSM4 Last Millennium coverage). Outside this range the prior fields collapse to NaN and the reconstruction will be all-NaN.'
      );
    }
    if (s.months.length === 0) {
      errors.push('Select at least one month for the seasonality of reconstruction.');
    } else {
      const bad = s.months.filter(function (m) { return !VALID_MONTHS.has(m); });
      if (bad.length > 0) {
        errors.push('Seasonality months must be in [-12..-1] ∪ [1..12]; got ' + bad.join(', ') + '.');
      }
    }
    if (!Number.isFinite(s.reconLocRad) || s.reconLocRad <= 0) {
      errors.push('Localization radius must be positive.');
    } else if (s.reconLocRad > LOC_RAD_MAX) {
      errors.push('Localization radius (' + s.reconLocRad + ' km) exceeds ' + LOC_RAD_MAX +
        ' km; localization is effectively disabled and distant proxies will pull on every grid cell.');
    }
    if (!Number.isFinite(s.assimFrac) || s.assimFrac < ASSIM_FRAC_MIN) {
      errors.push('Fraction of proxies to assimilate must be ≥ ' + ASSIM_FRAC_MIN +
        '; below this the reconstruction is effectively the prior mean.');
    } else if (s.assimFrac > ASSIM_FRAC_MAX) {
      errors.push('Fraction of proxies to assimilate must be ≤ ' + ASSIM_FRAC_MAX +
        '; leave at least some records for held-out validation.');
    }

    // ─── Soft warnings ───────────────────────────────────────────────────
    const yearsOutsidePrior = (s.reconPeriod[1] - s.reconPeriod[0]) - intersectLength(s.reconPeriod, PRIOR_COVERAGE);
    if (yearsOutsidePrior > 0) {
      warnings.push(
        yearsOutsidePrior + ' year(s) of your reconstruction fall outside the CCSM4 prior coverage [' +
        PRIOR_COVERAGE[0] + ', ' + PRIOR_COVERAGE[1] + ']. Those years are still reconstructed, ' +
        'but against a fixed prior pool drawn from 850–1850 — interpret long-extension recons accordingly.'
      );
    }
    const validationOverlap = intersectLength(s.reconPeriod, VALIDATION_WINDOW);
    if (validationOverlap === 0) {
      warnings.push(
        'Reconstruction period does not overlap the instrumental window [' + VALIDATION_WINDOW[0] +
        ', ' + VALIDATION_WINDOW[1] + ']. The validation page\'s GMST CE/R metrics will be empty.'
      );
    }
    const anomValidationOverlap = intersectLength(s.priorAnomPeriod, VALIDATION_WINDOW);
    if (anomValidationOverlap >= 10) {
      warnings.push(
        'Prior anomaly period overlaps the instrumental validation window by ' + anomValidationOverlap +
        ' year(s); reconstructed anomalies in 1880–2000 will be biased toward zero, depressing CE.'
      );
    }
    if (!contains(s.reconPeriod, s.priorAnomPeriod)) {
      warnings.push('Prior anomaly period is not fully contained in the reconstruction period; anomalies will be defined relative to a baseline outside your output.');
    }
    if (Number.isFinite(s.reconLocRad) && s.reconLocRad > 0 && s.reconLocRad < LOC_RAD_LOW) {
      warnings.push('Localization radius (' + s.reconLocRad + ' km) is shorter than typical synoptic scales (~' +
        LOC_RAD_LOW + ' km); many grid cells will see only their nearest proxies.');
    } else if (Number.isFinite(s.reconLocRad) && s.reconLocRad > LOC_RAD_HIGH && s.reconLocRad <= LOC_RAD_MAX) {
      warnings.push('Localization radius (' + s.reconLocRad + ' km) is above ' + LOC_RAD_HIGH +
        ' km; LMR v2.1 used 25,000 km — values beyond this approach global coupling.');
    }
    if (Number.isFinite(s.nens) && s.nens < NENS_SOFT_MIN) {
      warnings.push('Ensemble size (' + s.nens + ') is below ' + NENS_SOFT_MIN +
        '; small ensembles produce poorly conditioned EnKF analyses (LMR v2.1 used 100).');
    }
    if (Number.isFinite(s.reconSeeds) && Number.isFinite(s.nens) &&
        s.reconSeeds > 20 && s.nens > NENS_BATCH) {
      warnings.push('With ' + s.reconSeeds + ' seeds and nens=' + s.nens +
        ', auto-batching will multiply realizations further and may produce duplicate seeds (cfr_main_code.py auto-batch bug). Total realization count will be larger than expected.');
    }

    // ─── Live diagnostics ────────────────────────────────────────────────
    const nRealizations = (Number.isFinite(s.nens) && s.nens > NENS_BATCH)
      ? s.reconSeeds * Math.ceil(s.nens / NENS_BATCH)
      : s.reconSeeds;
    const totalEnsemble = Number.isFinite(s.nens) ? s.nens * nRealizations : 0;

    return {
      errors: errors,
      warnings: warnings,
      diagnostics: {
        totalEnsemble: totalEnsemble,
        nRealizations: nRealizations,
        validationOverlap: validationOverlap,
        yearsOutsidePrior: yearsOutsidePrior,
        reconSpan: s.reconPeriod[1] - s.reconPeriod[0]
      }
    };
  }

  function renderSection(panel, cls, title, items) {
    if (!items || items.length === 0) return;
    const section = document.createElement('div');
    section.className = 'lmr-diagnostics__section ' + cls;
    const heading = document.createElement('div');
    heading.className = 'lmr-diagnostics__title';
    heading.textContent = title;
    section.appendChild(heading);
    const ul = document.createElement('ul');
    items.forEach(function (msg) {
      const li = document.createElement('li');
      li.textContent = msg;
      ul.appendChild(li);
    });
    section.appendChild(ul);
    panel.appendChild(section);
  }

  function updateUI() {
    const panel = document.getElementById('lmr-diagnostics');
    if (!panel) return { errors: [], warnings: [], diagnostics: {} };
    const snap = readForm();
    const result = evaluate(snap);
    panel.innerHTML = '';

    renderSection(panel, 'lmr-diagnostics__errors', 'Must fix before submitting', result.errors);
    renderSection(panel, 'lmr-diagnostics__warnings', 'Warnings', result.warnings);

    const d = result.diagnostics;
    const infoLines = [
      'Reconstruction span: ' + d.reconSpan + ' year(s)',
      'Total ensemble size: ' + d.totalEnsemble +
        ' (nens ' + snap.nens + ' × ' + d.nRealizations + ' realization(s)' +
        (snap.nens > NENS_BATCH ? ', auto-batched' : '') + ')',
      'Validation overlap with [' + VALIDATION_WINDOW[0] + ', ' + VALIDATION_WINDOW[1] + ']: ' +
        d.validationOverlap + ' year(s)',
      'Years outside prior coverage [' + PRIOR_COVERAGE[0] + ', ' + PRIOR_COVERAGE[1] + ']: ' +
        d.yearsOutsidePrior
    ];
    renderSection(panel, 'lmr-diagnostics__info', 'Diagnostics', infoLines);

    const submitBtn = document.querySelector('#paramsForm button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = result.errors.length > 0;
      submitBtn.title = result.errors.length > 0 ? 'Resolve the errors above to submit' : '';
    }
    return result;
  }

  function passOrReport() {
    const result = updateUI();
    if (result.errors.length > 0) {
      alert('Cannot submit:\n\n• ' + result.errors.join('\n• '));
      return false;
    }
    return true;
  }

  function bind() {
    const ids = [
      'recon_period_fromInput', 'recon_period_toInput',
      'recon_period_fromSilder', 'recon_period_toSilder',
      'prior_anom_period_fromInput', 'prior_anom_period_toInput',
      'prior_anom_period_fromSilder', 'prior_anom_period_toSilder',
      'recon_seedsInput', 'recon_seedsSilder',
      'recon_loc_radInput', 'recon_loc_radSilder',
      'proxy_assim_fracInput', 'proxy_assim_fracSilder',
      'proxy_nensInput', 'proxy_nensSilder'
    ];
    ids.forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', updateUI);
      el.addEventListener('change', updateUI);
    });
    document.querySelectorAll('input[name="prior_annualize_months"]').forEach(function (el) {
      el.addEventListener('change', updateUI);
    });
    // The "check/uncheck all" button mutates checkboxes via .click() without
    // dispatching change on each — re-run after a tick so we catch the result.
    document.querySelectorAll('.check-uncheck').forEach(function (btn) {
      btn.addEventListener('click', function () { setTimeout(updateUI, 0); });
    });

    updateUI();
  }

  window.LMRConstraints = {
    readForm: readForm,
    evaluate: evaluate,
    updateUI: updateUI,
    passOrReport: passOrReport
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
