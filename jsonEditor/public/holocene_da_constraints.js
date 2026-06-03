// Live constraint validation + diagnostics for the Holocene DA editor form.
// See jsonEditor/Holocene_DA-parameter_constraints.md for failure-mode rationale.
(function () {
  'use strict';

  const AGE_RANGE_MODEL = [0, 22000];
  const MODEL_TIME_STEP = 10;
  const N_ENS_WARN = 30;
  const N_ENS_ERR = 10;
  const TIME_RESOLUTION_DEFAULT = 200;

  function num(el) {
    if (!el) return NaN;
    const v = Number(el.value);
    return v;
  }

  function rangePair(prefix) {
    const fromEl = document.getElementById(prefix + '_fromInput');
    const toEl = document.getElementById(prefix + '_toInput');
    return [num(fromEl), num(toEl)];
  }

  function readForm() {
    const tResRadio = document.querySelector('input[name="time_resolution"]:checked');
    const reconTypeRadio = document.querySelector('input[name="recon_type"]:checked');
    return {
      reconRange: rangePair('time_range_to_reconstruct'),
      referencePeriod: rangePair('time_reference'),
      priorModelInterval: rangePair('prior_model_interval'),
      priorWindow: num(document.getElementById('prior_time_windowInput')),
      timeResolution: tResRadio ? Number(tResRadio.value) : TIME_RESOLUTION_DEFAULT,
      nModels: document.querySelectorAll('input[name="prior_models"]:checked').length,
      reconType: reconTypeRadio ? reconTypeRadio.value : 'relative'
    };
  }

  function evaluate(s) {
    const errors = [];
    const warnings = [];
    const modelMin = AGE_RANGE_MODEL[0];
    const modelMax = AGE_RANGE_MODEL[1];
    const modelSpan = modelMax - modelMin;
    const isRelative = s.reconType === 'relative';

    const reconSpan = s.reconRange[1] - s.reconRange[0];
    if (s.reconRange[0] < modelMin || s.reconRange[1] > modelMax) {
      errors.push('Reconstruction range must be within [' + modelMin + ', ' + modelMax + '] years BP.');
    }
    if (!(s.reconRange[1] > s.reconRange[0])) {
      errors.push('Reconstruction max must be greater than min.');
    }

    if (isRelative) {
      if (s.referencePeriod[0] < modelMin || s.referencePeriod[1] > modelMax) {
        errors.push('Reference period must be within [' + modelMin + ', ' + modelMax + '] years BP — outside this range produces an all-NaN reconstruction.');
      }
      if (!(s.referencePeriod[1] > s.referencePeriod[0])) {
        errors.push('Reference period max must be greater than min.');
      }
    }

    if (s.timeResolution > reconSpan) {
      errors.push('time_resolution (' + s.timeResolution + ' yr) exceeds reconstruction span (' + reconSpan + ' yr); zero bins would be produced.');
    }

    if (!Number.isFinite(s.priorWindow) || s.priorWindow <= 0) {
      errors.push('prior_window must be a positive number.');
    } else if (s.priorWindow > modelSpan) {
      errors.push('prior_window (' + s.priorWindow + ' yr) exceeds the model age span (' + modelSpan + ' yr); the prior would silently collapse to a static prior. Reduce prior_window to use the time-varying prior.');
    }

    if (s.nModels === 0) {
      errors.push('Select at least one prior model.');
    }

    const priorIntervalSpan = Math.max(0, s.priorModelInterval[1] - s.priorModelInterval[0]);
    const effectiveWindow = Math.max(0, Math.min(
      Number.isFinite(s.priorWindow) ? s.priorWindow : 0,
      priorIntervalSpan
    ));
    const nEnsEstimate = s.nModels === 0
      ? 0
      : Math.floor(effectiveWindow / MODEL_TIME_STEP) * s.nModels;

    if (s.nModels > 0 && nEnsEstimate < N_ENS_ERR) {
      errors.push('Estimated ensemble size (' + nEnsEstimate + ') is below ' + N_ENS_ERR + '; the EnKF will be unstable.');
    } else if (s.nModels > 0 && nEnsEstimate < N_ENS_WARN) {
      warnings.push('Estimated ensemble size (' + nEnsEstimate + ') is below ' + N_ENS_WARN + '; reconstruction may be noisy.');
    }

    if (Number.isFinite(s.priorWindow) && s.priorWindow > 0 && s.priorWindow < 2 * s.timeResolution) {
      warnings.push('prior_window (' + s.priorWindow + ' yr) is less than 2 × time_resolution (' + (2 * s.timeResolution) + ' yr); per-age priors may be small and the EnKF noisy.');
    }

    if (isRelative) {
      const refContained = s.referencePeriod[0] >= s.reconRange[0] && s.referencePeriod[1] <= s.reconRange[1];
      if (!refContained) {
        errors.push('The time interval for reconstruction [' + s.reconRange[0] + ', ' + s.reconRange[1] + '] must fully cover the time interval for anomaly calculation [' + s.referencePeriod[0] + ', ' + s.referencePeriod[1] + '].');
      }
    }

    const bins = s.timeResolution > 0
      ? Math.floor(reconSpan / s.timeResolution)
      : 0;

    return {
      errors: errors,
      warnings: warnings,
      diagnostics: {
        bins: bins,
        nEnsEstimate: nEnsEstimate,
        effectiveWindow: effectiveWindow,
        priorIntervalSpan: priorIntervalSpan
      }
    };
  }

  function renderSection(panel, cls, title, items) {
    if (!items || items.length === 0) return;
    const section = document.createElement('div');
    section.className = 'hda-diagnostics__section ' + cls;
    const heading = document.createElement('div');
    heading.className = 'hda-diagnostics__title';
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
    const panel = document.getElementById('hda-diagnostics');
    if (!panel) return { errors: [], warnings: [], diagnostics: {} };
    const result = evaluate(readForm());
    panel.innerHTML = '';

    renderSection(panel, 'hda-diagnostics__errors', 'Must fix before submitting', result.errors);
    renderSection(panel, 'hda-diagnostics__warnings', 'Warnings', result.warnings);

    const diag = result.diagnostics;
    const snap = readForm();
    const infoLines = [
      'Reconstruction bins: ' + diag.bins,
      'Estimated ensemble size per age: ' + diag.nEnsEstimate +
        ' (effective prior window ' + diag.effectiveWindow + ' yr × ' + snap.nModels + ' model(s) ÷ ' + MODEL_TIME_STEP + ' yr step)'
    ];
    renderSection(panel, 'hda-diagnostics__info', 'Diagnostics', infoLines);

    const submitBtn = document.querySelector('#paramsForm button[type="submit"]');
    if (submitBtn) {
      const blocked = result.errors.length > 0;
      // The query-path form (forms-query/holocene_da.html) gates its submit
      // button on GitHub auth — only re-enable if that gate is satisfied.
      const hasAuthGate = document.getElementById('login-required-msg') !== null;
      const authReady = typeof isUserAuthenticated === 'undefined' || isUserAuthenticated;
      if (blocked) {
        submitBtn.disabled = true;
      } else if (!hasAuthGate || authReady) {
        submitBtn.disabled = false;
      }
      submitBtn.title = blocked ? 'Resolve the errors above to submit' : '';
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
      'time_range_to_reconstruct_fromInput', 'time_range_to_reconstruct_toInput',
      'time_range_to_reconstruct_fromSilder', 'time_range_to_reconstruct_toSilder',
      'time_reference_fromInput', 'time_reference_toInput',
      'time_reference_fromSilder', 'time_reference_toSilder',
      'prior_model_interval_fromInput', 'prior_model_interval_toInput',
      'prior_model_interval_fromSilder', 'prior_model_interval_toSilder',
      'prior_time_windowInput', 'prior_time_windowSilder'
    ];
    ids.forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', updateUI);
      el.addEventListener('change', updateUI);
    });

    const groups = ['time_resolution', 'prior_models', 'recon_type'];
    groups.forEach(function (name) {
      document.querySelectorAll('input[name="' + name + '"]').forEach(function (el) {
        el.addEventListener('change', updateUI);
      });
    });

    updateUI();
  }

  window.HDAConstraints = {
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
