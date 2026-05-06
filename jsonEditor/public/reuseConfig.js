/**
 * Reuse Custom Config — editor page frontend
 *
 * Loads a previous reconstruction's configs.yml and applies its values to
 * the editor form. Form-id convention is `{section}_{key}` (matching the
 * server's `editConfigs` in routes/editor.js: `formKey = key1 + '_' + key2`).
 *
 * Three field shapes show up in the editor forms:
 *   • range pair      → ids: {fk}_fromInput / {fk}_toInput (+ ..._fromSilder / ..._toSilder)
 *   • single numeric  → ids: {fk}Input (+ {fk}Silder)        — sic, "Silder" typo
 *   • plain field     → id: {fk}                              (text/select/etc.)
 *   • boolean         → id: {fk} (checkbox)
 *   • checkbox group  → name="{fk}" with one checkbox per option (e.g. months)
 *
 * Anything that doesn't match one of these is skipped with a warning.
 */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function byName(name) { return document.getElementsByName(name); }

  function setStatus(msg, kind) {
    var el = $('reuse-cfg-status'); if (!el) return;
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

  async function fetchFromUrl(url, recon) {
    var resp = await fetch('/reuse/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url, expectedKind: 'recon_config', recon: recon })
    });
    return resp.json();
  }
  async function uploadFile(file, recon) {
    var fd = new FormData();
    fd.append('file', file);
    fd.append('expectedKind', 'recon_config');
    fd.append('recon', recon);
    var resp = await fetch('/reuse/upload', { method: 'POST', body: fd });
    return resp.json();
  }

  // ───── apply parsed YAML to the form ────────────────────────────────

  function setIfExists(id, value) {
    var el = $(id);
    if (!el) return false;
    if (el.type === 'checkbox') el.checked = !!value;
    else el.value = (value == null) ? '' : String(value);
    return true;
  }

  function isFormControl(el) {
    if (!el) return false;
    var t = el.tagName;
    return t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA';
  }

  function applyValueAtPrefix(fk, val) {
    // 1) Range pair (fk_fromInput / fk_toInput).
    if (Array.isArray(val) && val.length === 2 && $(fk + '_fromInput')) {
      setIfExists(fk + '_fromInput',  val[0]);
      setIfExists(fk + '_toInput',    val[1]);
      setIfExists(fk + '_fromSilder', val[0]);
      setIfExists(fk + '_toSilder',   val[1]);
      return true;
    }
    // 2) Single numeric/free-form (fkInput).
    if ($(fk + 'Input')) {
      var scalar = Array.isArray(val) ? val.length : val;
      setIfExists(fk + 'Input',  scalar);
      setIfExists(fk + 'Silder', scalar);
      return true;
    }
    // 3) Radio/checkbox group BEFORE plain-id, because some forms wrap a
    //    group in a <div id="fk" name="fk">. getElementById('fk') would
    //    return that wrapper first and mask the actual inputs.
    var group = byName(fk);
    var checkboxes = [], radios = [];
    if (group && group.length > 0) {
      for (var j = 0; j < group.length; j++) {
        var g = group[j];
        if (!g) continue;
        if (g.type === 'checkbox') checkboxes.push(g);
        else if (g.type === 'radio') radios.push(g);
      }
    }
    if (radios.length > 0 && val !== null && val !== undefined && !Array.isArray(val)) {
      var want = String(val);
      for (var r = 0; r < radios.length; r++) {
        radios[r].checked = (String(radios[r].value) === want);
      }
      return true;
    }
    if (checkboxes.length > 0 && (Array.isArray(val) || typeof val === 'boolean')) {
      var wanted = {};
      var arr = Array.isArray(val) ? val : (val ? [true] : []);
      for (var i = 0; i < arr.length; i++) wanted[String(arr[i])] = true;
      for (var k = 0; k < checkboxes.length; k++) {
        var cb = checkboxes[k];
        cb.checked = !!wanted[String(cb.value)];
      }
      return true;
    }
    // 4) Plain form control with id == fk (input/select/textarea).
    if (isFormControl($(fk))) {
      setIfExists(fk, Array.isArray(val) ? val.join(',') : val);
      return true;
    }
    return false;
  }

  // The server has already translated runtime keys to form-id prefixes
  // (see translateFlatConfig in routes/reuse.js), so each top-level key is
  // ready to apply directly.
  function applyFlatConfig(parsed) {
    var applied = 0;
    var skipped = [];
    for (var key in parsed) {
      if (!Object.prototype.hasOwnProperty.call(parsed, key)) continue;
      if (applyValueAtPrefix(key, parsed[key])) applied++;
      else skipped.push(key);
    }
    return { applied: applied, skipped: skipped };
  }

  function applyNestedConfig(parsed) {
    var applied = 0;
    var skipped = [];
    for (var section in parsed) {
      if (!Object.prototype.hasOwnProperty.call(parsed, section)) continue;
      var sec = parsed[section];
      if (!sec || typeof sec !== 'object') continue;
      for (var key in sec) {
        if (!Object.prototype.hasOwnProperty.call(sec, key)) continue;
        var entry = sec[key];
        if (!entry || typeof entry !== 'object' || !('value' in entry)) continue;
        var fk = section + '_' + key;
        if (applyValueAtPrefix(fk, entry.value)) applied++;
        else skipped.push(fk);
      }
    }
    return { applied: applied, skipped: skipped };
  }

  function applyReconConfigToForm(parsed, shape) {
    return shape === 'flat'
      ? applyFlatConfig(parsed)
      : applyNestedConfig(parsed);
  }

  // ───── handlers ─────────────────────────────────────────────────────

  async function onLoadUrl() {
    var url = ($('reuse-cfg-url').value || '').trim();
    if (!url) { setStatus('Paste a GitHub URL first.', 'error'); return; }
    var recon = reconFromQuery();
    if (!recon) { setStatus('Missing recon in URL.', 'error'); return; }
    setStatus('Fetching…');
    try {
      var r = await fetchFromUrl(url, recon);
      handleResult(r);
    } catch (e) {
      setStatus('Network error: ' + e.message, 'error');
    }
  }
  async function onLoadFile(ev) {
    var f = ev.target.files && ev.target.files[0]; if (!f) return;
    var recon = reconFromQuery();
    if (!recon) { setStatus('Missing recon in URL.', 'error'); return; }
    setStatus('Uploading…');
    try {
      var r = await uploadFile(f, recon);
      handleResult(r);
    } catch (e) {
      setStatus('Network error: ' + e.message, 'error');
    }
  }

  function handleResult(r) {
    if (!r.ok) {
      setStatus('Validation failed: ' + joinErrors(r.errors), 'error');
      return;
    }
    var summary = applyReconConfigToForm(r.data, r.shape || 'nested');
    // Setting .value/.checked directly doesn't fire input/change, so the
    // editor's constraint module won't recompute on its own. Poke whichever
    // module is loaded for this form.
    if (window.LMRConstraints && typeof window.LMRConstraints.updateUI === 'function') window.LMRConstraints.updateUI();
    if (window.HDAConstraints && typeof window.HDAConstraints.updateUI === 'function') window.HDAConstraints.updateUI();
    var msg = 'Applied ' + summary.applied + ' field' + (summary.applied === 1 ? '' : 's') + ' to the form.';
    if (summary.skipped.length) {
      // Some fields legitimately have no counterpart in this view of the
      // form (e.g. forms-query/holocene_da omits proxy_archives and friends
      // because they're set during the upstream query / data-cleaning steps).
      msg += ' ' + summary.skipped.length + ' field' + (summary.skipped.length === 1 ? '' : 's')
           + ' had no counterpart in this form (handled upstream or hardcoded): '
           + summary.skipped.slice(0, 5).join(', ')
           + (summary.skipped.length > 5 ? ', …+' + (summary.skipped.length - 5) + ' more' : '') + '.';
    }
    var warn = (r.warnings && r.warnings.length)
      ? ' Warnings: ' + r.warnings.join('; ') + '.'
      : '';
    setStatus(msg + warn, 'ok');
  }

  // ───── wiring ───────────────────────────────────────────────────────

  function init() {
    var url = $('reuse-cfg-load-url'); if (url) url.addEventListener('click', onLoadUrl);
    var file = $('reuse-cfg-file');    if (file) file.addEventListener('change', onLoadFile);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
