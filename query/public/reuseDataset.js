/**
 * Reuse Custom Dataset — query page frontend
 *
 * Wires the #reuse-panel UI to the /reuse/* backend.
 *
 *   Apply to filters & review  → prefill the filter form, switch back to
 *                                'query' mode, refresh the map. Lets the user
 *                                tweak before the normal Submit.
 *   Continue →                  → POST to /reuse/commit which writes
 *                                query_params.json into userRecons/, then
 *                                redirects to /datacleaning or
 *                                /editor/querypath. Curated TSIDs are read
 *                                from the embedded `tsids` array in
 *                                query_params.json itself when present.
 */
(function () {
  'use strict';

  var loaded = {
    queryParams: null,    // validated object from /reuse/{fetch,upload}
    cleaningReport: null  // per-group decisions + notes from the original cleaning session
  };

  // True when the loaded query_params.json carries an embedded "tsids" array
  // (i.e. it's the enriched form services/github.js commits to user repos).
  function hasEmbeddedTSIDs() {
    return !!(loaded.queryParams
              && Array.isArray(loaded.queryParams.tsids)
              && loaded.queryParams.tsids.length > 0);
  }
  function embeddedAsCleaned() {
    if (!hasEmbeddedTSIDs()) return null;
    return {
      TSIDs: loaded.queryParams.tsids,
      removedTSIDs: Array.isArray(loaded.queryParams.removedTsids) ? loaded.queryParams.removedTsids : []
    };
  }
  function useEmbeddedSelected() {
    var el = document.getElementById('reuse-tsids-embedded');
    return !!(el && el.checked);
  }

  // ───── helpers ──────────────────────────────────────────────────────

  function $(id) { return document.getElementById(id); }

  function setStatus(msg, kind) {
    var el = $('reuse-status'); if (!el) return;
    el.textContent = msg || '';
    el.style.color = kind === 'error' ? '#b22' : (kind === 'ok' ? '#1a6e1a' : '#444');
  }

  function joinErrors(errs) {
    return Array.isArray(errs) && errs.length ? errs.join('; ') : 'Unknown error';
  }

  function reconFromQuery() {
    var p = new URLSearchParams(window.location.search);
    return p.get('recon') || '';
  }

  // ───── server calls ─────────────────────────────────────────────────

  async function fetchFromUrl(url, expectedKind) {
    var recon = reconFromQuery();
    var resp = await fetch('/reuse/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url, expectedKind: expectedKind, recon: recon })
    });
    return resp.json();
  }

  async function uploadFile(file, expectedKind) {
    var recon = reconFromQuery();
    var fd = new FormData();
    fd.append('file', file);
    fd.append('expectedKind', expectedKind);
    fd.append('recon', recon);
    var resp = await fetch('/reuse/upload', { method: 'POST', body: fd });
    return resp.json();
  }

  function describeResult(kind, result) {
    if (!result.ok) {
      setStatus('Validation failed: ' + joinErrors(result.errors), 'error');
      return false;
    }
    var label, detail;
    if (kind === 'cleaning_report') {
      label = 'cleaning_report.json';
      var groups = (result.data && result.data.length) || 0;
      var records = (typeof result.recordCount === 'number') ? result.recordCount : 0;
      detail = groups + ' group' + (groups === 1 ? '' : 's') + ', ' + records + ' record' + (records === 1 ? '' : 's');
    } else {
      label = 'query_params.json';
      // Count only "real" filter fields, not the enriched extras.
      var d = result.data || {};
      var filterFieldCount = Object.keys(d).filter(function (k) {
        return ['mode', 'tsids', 'removedTsids'].indexOf(k) === -1;
      }).length;
      var bits = [filterFieldCount + ' filter field' + (filterFieldCount === 1 ? '' : 's')];
      if (Array.isArray(d.tsids))        bits.push(d.tsids.length + ' embedded TSIDs');
      if (Array.isArray(d.removedTsids)) bits.push(d.removedTsids.length + ' removed');
      detail = bits.join(', ');
    }
    var warn = (result.warnings && result.warnings.length)
      ? ' (warnings: ' + result.warnings.join('; ') + ')'
      : '';
    setStatus('Loaded ' + label + ' — ' + detail + '.' + warn, 'ok');
    return true;
  }

  // Show/hide the embedded-TSIDs radio and update the skip-cleaning checkbox
  // gating. Called after any load, after radio change, and on init.
  function refreshTSIDsControls() {
    var choice    = $('reuse-qp-tsids-choice');
    var countEl   = $('reuse-qp-tsids-count');
    var rmCount   = $('reuse-qp-removed-count');
    var rmWrap    = $('reuse-qp-removed-count-wrap');
    var paramsOnly = $('reuse-tsids-params-only');
    var embedded   = $('reuse-tsids-embedded');
    var skipBox   = $('reuse-skip-cleaning');
    var skipLabel = $('reuse-skip-label');

    // Embedded-tsids choice block visibility.
    if (hasEmbeddedTSIDs()) {
      if (choice)  choice.style.display = 'block';
      if (countEl) countEl.textContent = String(loaded.queryParams.tsids.length);
      var rm = Array.isArray(loaded.queryParams.removedTsids) ? loaded.queryParams.removedTsids.length : 0;
      if (rmWrap)  rmWrap.style.display = rm > 0 ? 'inline' : 'none';
      if (rmCount) rmCount.textContent = String(rm);
    } else {
      if (choice) choice.style.display = 'none';
      // No embedded TSIDs ⇒ force the radio back to params-only so other gating is consistent.
      if (paramsOnly) paramsOnly.checked = true;
      if (embedded)   embedded.checked = false;
    }

    // Skip-cleaning checkbox is enabled iff the embedded TSID list will be committed.
    var willHaveTSIDs = hasEmbeddedTSIDs() && useEmbeddedSelected();
    if (skipBox)   skipBox.disabled = !willHaveTSIDs;
    if (skipLabel) {
      skipLabel.style.color = willHaveTSIDs ? '#333' : '#999';
      skipLabel.style.cursor = willHaveTSIDs ? 'pointer' : 'not-allowed';
    }

    // Continue is only meaningful when we have a TSID list to commit. Without
    // one, /datacleaning has nothing to read and /editor/querypath would
    // silently bypass data cleaning — which surprises users. In that state,
    // the "Apply to filters & review" path (then normal Submit) is correct.
    var continueBtn = $('reuse-apply-continue');
    if (continueBtn) {
      continueBtn.disabled = !willHaveTSIDs;
      continueBtn.style.opacity = willHaveTSIDs ? '1' : '0.5';
      continueBtn.style.cursor = willHaveTSIDs ? 'pointer' : 'not-allowed';
      continueBtn.title = willHaveTSIDs
        ? 'Save the loaded files for this reconstruction and continue.'
        : 'No curated TSIDs in the loaded query_params.json. Use "Apply to filters & review" to populate the form, then click Submit to run the normal query → data-cleaning → editor flow.';
    }
  }

  // ───── form prefill ─────────────────────────────────────────────────

  // Set a chip-input's underlying hidden input and trigger the chip widget
  // to re-render. Mirrors the pattern in queryHelpers.js (chip:sync trigger
  // after PAGE_CONFIG defaults are applied).
  function setChipInput(id, value) {
    var el = $(id); if (!el) return;
    el.value = value == null ? '' : String(value);
    if (window.jQuery) {
      try { window.jQuery(el).trigger('chip:sync'); } catch (e) { /* widget not ready */ }
    }
  }

  function setNumber(id, value) {
    var el = $(id); if (!el) return;
    el.value = (value == null || isNaN(value)) ? '' : String(value);
  }

  // For range sliders that come in pairs (slider + numeric input), set both.
  function setSliderPair(sliderId, inputId, value) {
    setNumber(sliderId, value);
    setNumber(inputId, value);
  }

  function applyQueryParamsToForm(qp) {
    // String chip inputs
    setChipInput('archiveTypeIn', qp.archiveTypes);
    setChipInput('proxy', qp.proxy);
    setChipInput('variableName', qp.variableName);
    setChipInput('interpVar', qp.interpVars);
    setChipInput('countryIn', qp.country);
    setChipInput('continentIn', qp.continent);
    setChipInput('compilationIn', qp.compilation);
    setChipInput('seasonality1', qp.seasonality);

    // Coordinates
    var coordsOn = $('coordsOn');
    if (Array.isArray(qp.coords) && qp.coords.length === 4) {
      setNumber('lat_min', qp.coords[0]);
      setNumber('lat_max', qp.coords[1]);
      setNumber('lon_min', qp.coords[2]);
      setNumber('lon_max', qp.coords[3]);
      if (coordsOn) coordsOn.checked = true;
    } else if (coordsOn) {
      coordsOn.checked = false;
    }

    // Sliders + their toggle checkboxes
    if (typeof qp.extendBack === 'number') {
      setSliderPair('extendBackSlider', 'extendBackInput', qp.extendBack);
      var eb = $('extendBackOn'); if (eb) eb.checked = true;
    }
    if (typeof qp.extendForward === 'number') {
      setSliderPair('extendForwardSlider', 'extendForwardInput', qp.extendForward);
      var ef = $('extendForwardOn'); if (ef) ef.checked = true;
    }
    if (qp.subannualOnly === true) {
      var sa = $('subannualOnly'); if (sa) sa.checked = true;
      var ro1 = $('resolutionOn'); if (ro1) ro1.checked = true;
    } else if (typeof qp.resolution === 'number') {
      setSliderPair('resolutionSlider', 'resolutionInput', qp.resolution);
      var ro2 = $('resolutionOn'); if (ro2) ro2.checked = true;
    }
    if (typeof qp.minRecordLength === 'number') {
      setNumber('minLengthInput', qp.minRecordLength);
      var ml = $('minLengthOn'); if (ml) ml.checked = true;
    }

    if (typeof updateExtendBackReadout === 'function') updateExtendBackReadout();
    if (typeof updateExtendForwardReadout === 'function') updateExtendForwardReadout();
    if (typeof updateFilters === 'function') updateFilters();
  }

  // ───── button handlers ──────────────────────────────────────────────

  async function onLoadQpUrl() {
    var url = ($('reuse-qp-url').value || '').trim();
    if (!url) { setStatus('Paste a GitHub URL first.', 'error'); return; }
    setStatus('Fetching…');
    try {
      var r = await fetchFromUrl(url, 'query_params');
      if (describeResult('query_params', r)) loaded.queryParams = r.data;
    } catch (e) {
      setStatus('Network error: ' + e.message, 'error');
    }
    refreshTSIDsControls();
  }
  async function onLoadQpFile(ev) {
    var f = ev.target.files && ev.target.files[0]; if (!f) return;
    setStatus('Uploading…');
    try {
      var r = await uploadFile(f, 'query_params');
      if (describeResult('query_params', r)) loaded.queryParams = r.data;
    } catch (e) {
      setStatus('Network error: ' + e.message, 'error');
    }
    refreshTSIDsControls();
  }
  async function onLoadCrUrl() {
    var url = ($('reuse-cr-url').value || '').trim();
    if (!url) { setStatus('Paste a GitHub URL first.', 'error'); return; }
    setStatus('Fetching…');
    try {
      var r = await fetchFromUrl(url, 'cleaning_report');
      if (describeResult('cleaning_report', r)) loaded.cleaningReport = r.data;
    } catch (e) {
      setStatus('Network error: ' + e.message, 'error');
    }
  }
  async function onLoadCrFile(ev) {
    var f = ev.target.files && ev.target.files[0]; if (!f) return;
    setStatus('Uploading…');
    try {
      var r = await uploadFile(f, 'cleaning_report');
      if (describeResult('cleaning_report', r)) loaded.cleaningReport = r.data;
    } catch (e) {
      setStatus('Network error: ' + e.message, 'error');
    }
  }

  function onApplyAndStay() {
    if (!loaded.queryParams) {
      setStatus('Load a query_params.json first.', 'error');
      return;
    }
    applyQueryParamsToForm(loaded.queryParams);
    if (typeof setMode === 'function') setMode('query');
    if (typeof sendQuery === 'function') sendQuery();
    setStatus('Applied to filters. Tweak below and Submit, or switch back to Reuse mode.', 'ok');
  }

  async function onApplyAndContinue() {
    if (!loaded.queryParams) {
      setStatus('Load a query_params.json first.', 'error');
      return;
    }
    var uniqueID = ($('uniqueID') && $('uniqueID').value) || '';
    var recon = ($('recon') && $('recon').value) || reconFromQuery();
    if (!uniqueID || !recon) {
      setStatus('Missing uniqueID or recon in the page URL.', 'error');
      return;
    }
    var skipBox = $('reuse-skip-cleaning');
    var skip = !!(skipBox && !skipBox.disabled && skipBox.checked);

    // Source the curated TSID payload from the embedded `tsids` array in
    // query_params.json when the user opted in via the radio. Without it the
    // server has no TSID list and the skip checkbox is moot.
    var cleanedToSend = useEmbeddedSelected() ? embeddedAsCleaned() : null;

    setStatus('Saving…');
    try {
      var resp = await fetch('/reuse/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uniqueID: uniqueID,
          recon: recon,
          queryParams: loaded.queryParams || undefined,
          cleanedTSIDs: cleanedToSend || undefined,
          cleaningReport: loaded.cleaningReport || undefined,
          skipDataCleaning: skip
        })
      });
      var j = await resp.json();
      if (!j.ok) {
        setStatus('Commit failed: ' + joinErrors(j.errors), 'error');
        return;
      }
      // Carry over user/domain/language from the current URL.
      var carry = ['user', 'domain', 'language', 'useGitHubActions'];
      var cur = new URLSearchParams(window.location.search);
      var dest = new URL(j.redirect, window.location.origin);
      for (var i = 0; i < carry.length; i++) {
        var v = cur.get(carry[i]);
        if (v && !dest.searchParams.has(carry[i])) dest.searchParams.set(carry[i], v);
      }
      window.location.href = dest.pathname + dest.search;
    } catch (e) {
      setStatus('Network error: ' + e.message, 'error');
    }
  }

  // ───── wiring ───────────────────────────────────────────────────────

  function init() {
    var byId = [
      ['reuse-qp-load-url', 'click', onLoadQpUrl],
      ['reuse-qp-file',     'change', onLoadQpFile],
      ['reuse-apply-stay',     'click', onApplyAndStay],
      ['reuse-apply-continue', 'click', onApplyAndContinue],
      ['reuse-tsids-params-only', 'change', refreshTSIDsControls],
      ['reuse-tsids-embedded',    'change', refreshTSIDsControls],
      ['reuse-cr-load-url', 'click',  onLoadCrUrl],
      ['reuse-cr-file',     'change', onLoadCrFile]
    ];
    for (var i = 0; i < byId.length; i++) {
      var el = $(byId[i][0]);
      if (el) el.addEventListener(byId[i][1], byId[i][2]);
    }
    refreshTSIDsControls();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
