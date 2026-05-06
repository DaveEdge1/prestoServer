/**
 * Reuse routes
 *
 * Lets users start a reconstruction from a previous one's artifacts:
 *   - query_params.json     (filter inputs for the query page)
 *   - cleaned_TSIDs.json    (curated TSID list from data-cleaning)
 *   - configs.yml           (reconstruction config for the editor page)
 *
 * Three endpoints:
 *   POST /reuse/fetch    — pull a file from a public GitHub URL
 *   POST /reuse/upload   — accept a multipart upload of the same file
 *   POST /reuse/commit   — write validated query_params/cleaned_TSIDs into
 *                          the user's userRecons/{uniqueID}_{recon}/ dir
 *                          (matches the layout that routes/editor.js expects)
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const multer = require('multer');
const config = require('../config');

const MAX_FILE_BYTES = 1024 * 1024; // 1 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 }
});

// ───────────────────────── URL handling ──────────────────────────────

// Accept either:
//   https://github.com/<owner>/<repo>/blob/<branch>/<path>
//   https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>
// Anything else is rejected.
function normalizeGitHubUrl(url) {
  if (typeof url !== 'string') return null;
  url = url.trim();

  const blob = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
  if (blob) {
    return `https://raw.githubusercontent.com/${blob[1]}/${blob[2]}/${blob[3]}/${blob[4]}`;
  }
  if (/^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/.+$/.test(url)) {
    return url;
  }
  return null;
}

async function fetchText(rawUrl) {
  const r = await fetch(rawUrl, { redirect: 'follow' });
  if (!r.ok) {
    const hint = r.status === 404
      ? 'Could not fetch (private repo or wrong path?)'
      : `Fetch failed with HTTP ${r.status}`;
    throw new Error(hint);
  }
  const len = r.headers.get('content-length');
  if (len && Number(len) > MAX_FILE_BYTES) {
    throw new Error(`File too large (>${MAX_FILE_BYTES} bytes)`);
  }
  const text = await r.text();
  if (text.length > MAX_FILE_BYTES) {
    throw new Error(`File too large (>${MAX_FILE_BYTES} bytes)`);
  }
  return text;
}

// ───────────────────────── Validators ────────────────────────────────

const QP_STRING_KEYS = ['archiveTypes', 'proxy', 'variableName', 'interpVars',
  'country', 'continent', 'compilation', 'seasonality'];
const QP_NUMBER_KEYS = ['extendBack', 'extendForward', 'resolution', 'minRecordLength'];
const QP_MODE_VALUES = new Set(['archived', 'filtered']);
// "Enriched" fields appended by services/github.js when committing
// query_params.json to a user repo. Recognized here so validation passes
// cleanly when reusing files pulled directly from such repos.
const QP_TSID_ARRAY_KEYS = ['tsids', 'removedTsids'];
const QP_KNOWN_KEYS = new Set([
  ...QP_STRING_KEYS, ...QP_NUMBER_KEYS, 'coords', 'subannualOnly',
  'mode', ...QP_TSID_ARRAY_KEYS
]);

function validateQueryParams(obj) {
  const errors = [];
  const warnings = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, errors: ['Top-level must be a JSON object'] };
  }

  for (const k of QP_STRING_KEYS) {
    if (k in obj && obj[k] !== null && typeof obj[k] !== 'string') {
      errors.push(`${k} must be a string or null`);
    }
  }
  for (const k of QP_NUMBER_KEYS) {
    if (k in obj && obj[k] !== null && typeof obj[k] !== 'number') {
      errors.push(`${k} must be a number or null`);
    }
  }
  if ('subannualOnly' in obj && typeof obj.subannualOnly !== 'boolean') {
    errors.push('subannualOnly must be a boolean');
  }
  if ('mode' in obj && obj.mode !== null && !QP_MODE_VALUES.has(obj.mode)) {
    errors.push('mode must be "archived" or "filtered"');
  }
  for (const k of QP_TSID_ARRAY_KEYS) {
    if (k in obj && obj[k] !== null) {
      if (!Array.isArray(obj[k]) || obj[k].some(t => typeof t !== 'string')) {
        errors.push(`${k} must be an array of strings`);
      }
    }
  }
  if ('coords' in obj) {
    const c = obj.coords;
    if (!Array.isArray(c) || c.length !== 4 || c.some(v => typeof v !== 'number')) {
      errors.push('coords must be an array of 4 numbers [lat_min, lat_max, lon_min, lon_max]');
    } else {
      if (c[0] < -90 || c[0] > 90) errors.push('coords[0] (lat_min) out of range -90..90');
      if (c[1] < -90 || c[1] > 90) errors.push('coords[1] (lat_max) out of range -90..90');
      if (c[2] < -180 || c[2] > 180) errors.push('coords[2] (lon_min) out of range -180..180');
      if (c[3] < -180 || c[3] > 180) errors.push('coords[3] (lon_max) out of range -180..180');
    }
  }

  for (const k of Object.keys(obj)) {
    if (!QP_KNOWN_KEYS.has(k)) warnings.push(`Unknown field "${k}" (ignored)`);
  }

  return { ok: errors.length === 0, errors, warnings, data: obj };
}

// cleaning_report.json is an array of groups, each: { groupId, records:
// [{tsid, dataSetName, decision}], notes }. Format is loose; we only check
// the outer shape so future additions don't break reuse.
function validateCleaningReport(arr) {
  const errors = [];
  const warnings = [];
  if (!Array.isArray(arr)) {
    return { ok: false, errors: ['Top-level must be a JSON array of groups'] };
  }
  let recordCount = 0;
  for (let i = 0; i < arr.length; i++) {
    const g = arr[i];
    if (!g || typeof g !== 'object' || Array.isArray(g)) {
      errors.push(`Group [${i}] must be an object`);
      continue;
    }
    if (!('records' in g) || !Array.isArray(g.records)) {
      warnings.push(`Group [${i}] has no records array (kept as-is)`);
      continue;
    }
    recordCount += g.records.length;
  }
  if (errors.length === 0 && arr.length === 0) {
    warnings.push('Report is empty (no groups)');
  }
  return { ok: errors.length === 0, errors, warnings, data: arr, recordCount };
}

function validateCleanedTSIDs(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, errors: ['Top-level must be a JSON object'] };
  }
  if (!Array.isArray(obj.TSIDs)) {
    errors.push('TSIDs must be an array');
  } else if (obj.TSIDs.some(t => typeof t !== 'string' || t.length === 0)) {
    errors.push('Every TSID must be a non-empty string');
  }
  if ('removedTSIDs' in obj && obj.removedTSIDs !== null) {
    if (!Array.isArray(obj.removedTSIDs) || obj.removedTSIDs.some(t => typeof t !== 'string')) {
      errors.push('removedTSIDs must be an array of strings');
    }
  }
  for (const k of ['groupNotes', 'datasetNotes']) {
    if (k in obj && obj[k] !== null && (typeof obj[k] !== 'object' || Array.isArray(obj[k]))) {
      errors.push(`${k} must be an object`);
    }
  }
  return { ok: errors.length === 0, errors, data: obj };
}

// Runtime keys that are never user-facing — they're set server-side in
// services/github.js (data_dir, proxydb_path, save_dirpath) before the
// workflow runs. Drop them before returning so the user doesn't see them
// in the "skipped" list.
const RUNTIME_KEYS_HIDDEN = {
  LMR: new Set(['proxydb_path', 'save_dirpath']),
  holocene_da: new Set(['data_dir'])
};

// Per-recon mapping from runtime-config (flat YAML) keys → form-id prefixes.
// LMR has only a couple of renames; holocene_da has a full lookup table that
// we invert from prestoForm/holocene_da/lookup.json. Anything not in the map
// is tried as-is (covers cases where runtime key == form prefix).
let _runtimeKeyMaps = null;
function loadRuntimeKeyMaps() {
  if (_runtimeKeyMaps) return _runtimeKeyMaps;
  const maps = {
    LMR: { assim_frac: 'proxy_assim_frac', nens: 'proxy_nens' }
  };
  try {
    const lookupPath = path.join(config.paths.prestoForm, 'holocene_da', 'lookup.json');
    const lookup = JSON.parse(fs.readFileSync(lookupPath, 'utf8'));
    const inv = {};
    for (const formKey of Object.keys(lookup)) {
      const orig = lookup[formKey] && lookup[formKey].orig;
      if (orig) inv[orig] = formKey;
    }
    maps.holocene_da = inv;
  } catch (e) {
    console.warn('[reuse] could not load holocene_da lookup.json:', e.message);
    maps.holocene_da = {};
  }
  _runtimeKeyMaps = maps;
  return maps;
}

// Translate a flat runtime YAML object to a {form_prefix: value} object.
// Returns { translated, unmapped } so the caller can surface unmapped keys
// as warnings.
function translateFlatConfig(parsed, recon) {
  const map = loadRuntimeKeyMaps()[recon] || {};
  const hidden = RUNTIME_KEYS_HIDDEN[recon] || new Set();
  const translated = {};
  const unmapped = [];
  for (const key of Object.keys(parsed)) {
    if (hidden.has(key)) continue;
    let val = parsed[key];
    // LMR special case: recon_seeds is committed as the array [1..N]; the
    // form takes the count N. Apply this before the form-id rename, since
    // the runtime key name is what triggers it.
    if (recon === 'LMR' && key === 'recon_seeds' && Array.isArray(val)) {
      val = val.length;
    }
    const formPrefix = map[key] || key;
    translated[formPrefix] = val;
    if (!(key in map)) unmapped.push(key);
  }
  return { translated, unmapped };
}

// Returns 'nested' if the file looks like the editor template's configs.yml
// shape ({section: {key: {value, default, ...}}}), or 'flat' if it looks like
// the runtime lmr_configs.yml shape ({key: scalar_or_array}). Used to pick the
// right validation path; the flat shape is what gets committed to user repos.
function detectConfigShape(parsed) {
  if (!parsed || typeof parsed !== 'object') return 'unknown';
  for (const k of Object.keys(parsed)) {
    const v = parsed[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      // If any nested key is itself a mapping with a `value` field, treat as nested.
      for (const k2 of Object.keys(v)) {
        const vv = v[k2];
        if (vv && typeof vv === 'object' && !Array.isArray(vv) && 'value' in vv) {
          return 'nested';
        }
      }
    }
  }
  return 'flat';
}

function validateReconConfig(yamlText, recon) {
  let parsed;
  try {
    parsed = YAML.parse(yamlText);
  } catch (e) {
    return { ok: false, errors: [`YAML parse error: ${e.message}`] };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, errors: ['Top-level must be a YAML mapping'] };
  }

  const shape = detectConfigShape(parsed);
  const errors = [];
  const warnings = [];

  if (shape === 'flat') {
    // Flat runtime config (the format committed to user GitHub repos).
    // Sanity-check value shapes, then translate runtime keys to form-id
    // prefixes server-side so the frontend doesn't carry recon-specific
    // mapping logic.
    let count = 0;
    const cleaned = {};
    for (const k of Object.keys(parsed)) {
      const v = parsed[k];
      if (v === null) { cleaned[k] = v; count++; continue; }
      if (Array.isArray(v)) {
        if (v.some(x => x !== null && typeof x === 'object')) {
          warnings.push(`"${k}" array contains non-scalar values (ignored)`);
          continue;
        }
        cleaned[k] = v;
        count++;
      } else if (typeof v === 'object') {
        warnings.push(`"${k}" is a nested mapping in a flat config (ignored)`);
      } else {
        cleaned[k] = v;
        count++;
      }
    }
    if (count === 0) errors.push('No usable fields found in flat config');

    const { translated } = translateFlatConfig(cleaned, recon);
    return { ok: errors.length === 0, errors, warnings, data: translated, shape: 'flat' };
  }

  // Nested editor template format — compare against prestoForm/{recon}/configs.yml.
  const templatePath = path.join(config.paths.prestoForm, recon, 'configs.yml');
  if (!fs.existsSync(templatePath)) {
    return { ok: false, errors: [`Unknown recon "${recon}" (no template found)`] };
  }
  const template = YAML.parse(fs.readFileSync(templatePath, 'utf8'));

  let matchedSections = 0;

  for (const section of Object.keys(parsed)) {
    if (!(section in template)) {
      warnings.push(`Section "${section}" not in template (ignored)`);
      continue;
    }
    matchedSections++;
    const upSec = parsed[section];
    const tplSec = template[section];
    if (!upSec || typeof upSec !== 'object') {
      errors.push(`Section "${section}" must be a mapping`);
      continue;
    }
    for (const key of Object.keys(upSec)) {
      if (!(key in tplSec)) {
        warnings.push(`Field "${section}.${key}" not in template (ignored)`);
        continue;
      }
      const upEntry = upSec[key];
      if (!upEntry || typeof upEntry !== 'object' || !('value' in upEntry)) {
        errors.push(`"${section}.${key}" must be a mapping with a "value" key`);
        continue;
      }
      const upVal = upEntry.value;
      const tplVal = tplSec[key].value;
      const tplIsArr = Array.isArray(tplVal);
      const upIsArr = Array.isArray(upVal);
      if (tplIsArr !== upIsArr) {
        errors.push(`"${section}.${key}.value" type mismatch (expected ${tplIsArr ? 'array' : typeof tplVal})`);
        continue;
      }
      if (!tplIsArr && typeof upVal !== typeof tplVal && upVal !== null) {
        errors.push(`"${section}.${key}.value" type mismatch (expected ${typeof tplVal}, got ${typeof upVal})`);
      }
    }
  }

  if (matchedSections === 0) {
    errors.push('No template sections matched — file may not be a recon config for this reconstruction type');
  }

  return { ok: errors.length === 0, errors, warnings, data: parsed, shape: 'nested' };
}

function validateByKind(text, kind, recon) {
  if (kind === 'recon_config') {
    return validateReconConfig(text, recon);
  }
  let obj;
  try {
    obj = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`JSON parse error: ${e.message}`] };
  }
  if (kind === 'query_params')    return validateQueryParams(obj);
  if (kind === 'cleaned_TSIDs')   return validateCleanedTSIDs(obj);
  if (kind === 'cleaning_report') return validateCleaningReport(obj);
  return { ok: false, errors: [`Unknown kind: ${kind}`] };
}

// ───────────────────────── Routes ────────────────────────────────────

router.post('/fetch', async (req, res) => {
  const { url, expectedKind, recon } = req.body || {};
  if (!url || !expectedKind) {
    return res.status(400).json({ ok: false, errors: ['url and expectedKind are required'] });
  }
  const raw = normalizeGitHubUrl(url);
  if (!raw) {
    return res.status(400).json({
      ok: false,
      errors: ['URL must be a github.com blob URL or a raw.githubusercontent.com URL']
    });
  }
  let text;
  try {
    text = await fetchText(raw);
  } catch (e) {
    return res.status(400).json({ ok: false, errors: [e.message] });
  }
  return res.json(validateByKind(text, expectedKind, recon));
});

router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, errors: ['file is required'] });
  }
  const expectedKind = (req.body && req.body.expectedKind) || '';
  const recon = (req.body && req.body.recon) || '';
  const text = req.file.buffer.toString('utf8');
  return res.json(validateByKind(text, expectedKind, recon));
});

// Multer error handler for /upload (body-parser errors are caught by the
// global handler in app.js).
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ ok: false, errors: [err.message] });
  }
  return next(err);
});

router.post('/commit', (req, res) => {
  const { uniqueID, recon, queryParams, cleanedTSIDs, cleaningReport, skipDataCleaning } = req.body || {};
  if (!uniqueID || !recon) {
    return res.status(400).json({ ok: false, errors: ['uniqueID and recon are required'] });
  }
  if (!/^[A-Za-z0-9_-]+$/.test(uniqueID) || !/^[A-Za-z0-9_-]+$/.test(recon)) {
    return res.status(400).json({ ok: false, errors: ['uniqueID and recon must be alphanumeric'] });
  }

  // Re-validate before writing — never trust whatever the client says is "ok".
  if (queryParams) {
    const v = validateQueryParams(queryParams);
    if (!v.ok) return res.status(400).json({ ok: false, errors: v.errors });
  }
  if (cleanedTSIDs) {
    const v = validateCleanedTSIDs(cleanedTSIDs);
    if (!v.ok) return res.status(400).json({ ok: false, errors: v.errors });
  }
  if (cleaningReport) {
    const v = validateCleaningReport(cleaningReport);
    if (!v.ok) return res.status(400).json({ ok: false, errors: v.errors });
  }

  const dir = path.join(config.paths.userRecons, `${uniqueID}_${recon}`);
  fs.mkdirSync(dir, { recursive: true });

  if (queryParams) {
    fs.writeFileSync(path.join(dir, 'query_params.json'), JSON.stringify(queryParams, null, 2));
  }
  if (cleanedTSIDs) {
    fs.writeFileSync(path.join(dir, 'cleaned_TSIDs.json'), JSON.stringify(cleanedTSIDs, null, 2));
    // /datacleaning reads TSIDs.json (the *original* query result, normally
    // written by routes/lipds.js on submit). When reusing a prior curation
    // there's no fresh query, so reconstruct the original set from
    // cleaned_TSIDs.json: kept ∪ removed. This is what makes the cleaning
    // page show "kept of total" correctly (e.g. "1001 of 1207") instead of
    // "1001 of 1001".
    const kept = Array.isArray(cleanedTSIDs.TSIDs) ? cleanedTSIDs.TSIDs : [];
    const removed = Array.isArray(cleanedTSIDs.removedTSIDs) ? cleanedTSIDs.removedTSIDs : [];
    const seen = new Set();
    const union = [];
    for (const t of kept)    { if (!seen.has(t)) { seen.add(t); union.push(t); } }
    for (const t of removed) { if (!seen.has(t)) { seen.add(t); union.push(t); } }
    fs.writeFileSync(path.join(dir, 'TSIDs.json'), JSON.stringify({ TSIDs: union }));
  }
  if (cleaningReport) {
    fs.writeFileSync(path.join(dir, 'cleaning_report.json'), JSON.stringify(cleaningReport, null, 2));
  }

  // Routing: same rule the existing flow uses (filtered TSIDs → datacleaning;
  // otherwise editor). When the user opts to skip cleaning, we send them
  // straight to the editor, which will pick up cleaned_TSIDs.json from disk.
  const passThroughCleaning = cleanedTSIDs && !skipDataCleaning;
  const target = passThroughCleaning ? '/datacleaning' : '/editor/querypath';
  const qs = `?recon=${encodeURIComponent(recon)}&uniqueID=${encodeURIComponent(uniqueID)}`;
  return res.json({ ok: true, redirect: target + qs });
});

module.exports = router;
