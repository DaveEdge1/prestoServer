/**
 * Data Cleaning routes
 * Sits between the query page and the editor for filtered TSID paths.
 * Detects duplicate proxy records and lets the user review/remove them.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const YAML = require('yaml');
const config = require('../config');

const PROXY_ANALYSIS_URL = process.env.PROXY_ANALYSIS_URL || 'http://proxy-analysis:8090';
const queryDir = path.join(__dirname, '..', 'query');

// GET / - Serve the data cleaning page
router.get('/', (req, res) => {
  res.sendFile(path.join(queryDir, 'datacleaning.html'));
});

// POST /analyze - Call proxy-analysis service and return results
router.post('/analyze', async (req, res) => {
  const { uniqueID, recon } = req.body;

  if (!uniqueID || !recon) {
    return res.status(400).json({ error: 'uniqueID and recon are required' });
  }

  const userReconDir = path.join(config.paths.userRecons, `${uniqueID}_${recon}`);
  const tsidsPath = path.join(userReconDir, 'TSIDs.json');

  if (!fs.existsSync(tsidsPath)) {
    return res.status(404).json({ error: 'TSIDs.json not found — query results may have expired' });
  }

  let tsids;
  try {
    tsids = JSON.parse(fs.readFileSync(tsidsPath, 'utf8')).TSIDs;
  } catch (err) {
    return res.status(500).json({ error: 'Failed to parse TSIDs.json' });
  }

  if (!Array.isArray(tsids) || tsids.length === 0) {
    return res.status(400).json({ error: 'No TSIDs found in TSIDs.json' });
  }

  try {
    const response = await axios.post(
      `${PROXY_ANALYSIS_URL}/analyze`,
      { tsids },
      { timeout: 120000 } // 2 minutes — metadata download can be slow
    );
    res.json(response.data);
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return res.status(503).json({ error: 'Proxy analysis service is unavailable' });
    }
    console.error('proxy-analysis error:', err.message);
    res.status(502).json({ error: `Analysis failed: ${err.message}` });
  }
});

// GET /analyze-stream - SSE proxy: streams progress events from proxy-analysis
router.get('/analyze-stream', async (req, res) => {
  const { uniqueID, recon } = req.query;

  if (!uniqueID || !recon) {
    return res.status(400).json({ error: 'uniqueID and recon are required' });
  }

  const userReconDir = path.join(config.paths.userRecons, `${uniqueID}_${recon}`);
  const tsidsPath = path.join(userReconDir, 'TSIDs.json');

  if (!fs.existsSync(tsidsPath)) {
    return res.status(404).json({ error: 'TSIDs.json not found — query results may have expired' });
  }

  let tsids;
  try {
    tsids = JSON.parse(fs.readFileSync(tsidsPath, 'utf8')).TSIDs;
  } catch (err) {
    return res.status(500).json({ error: 'Failed to parse TSIDs.json' });
  }

  if (!Array.isArray(tsids) || tsids.length === 0) {
    return res.status(400).json({ error: 'No TSIDs found in TSIDs.json' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  try {
    const response = await axios.post(
      `${PROXY_ANALYSIS_URL}/analyze-stream`,
      { tsids },
      { responseType: 'stream', timeout: 600000 } // 10 min — events flow continuously
    );

    // Pipe the SSE stream directly to the client
    response.data.pipe(res);

    // Clean up when client disconnects
    req.on('close', () => {
      response.data.destroy();
    });
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      res.write(`data: ${JSON.stringify({ phase: "error", message: "Proxy analysis service is unavailable" })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ phase: "error", message: err.message })}\n\n`);
    }
    res.end();
  }
});

// POST /correlate - Compute Pearson + DTW for a specific group's TSIDs (on demand)
router.post('/correlate', async (req, res) => {
  const { tsids } = req.body;

  if (!Array.isArray(tsids) || tsids.length < 2) {
    return res.status(400).json({ error: 'tsids array with at least 2 items is required' });
  }

  try {
    const response = await axios.post(
      `${PROXY_ANALYSIS_URL}/correlate`,
      { tsids },
      { timeout: 180000 }
    );
    res.json(response.data);
  } catch (err) {
    console.error('proxy-analysis correlate error:', err.message);
    res.status(502).json({ error: `Correlation failed: ${err.message}` });
  }
});

// POST /exact-duplicates - Find clusters of exact-duplicate records within the supplied spatial groups
router.post('/exact-duplicates', async (req, res) => {
  const { groups, include_near, near_threshold } = req.body;

  if (!Array.isArray(groups)) {
    return res.status(400).json({ error: 'groups array is required' });
  }

  try {
    const response = await axios.post(
      `${PROXY_ANALYSIS_URL}/exact-duplicates`,
      { groups, include_near: !!include_near, near_threshold: Number(near_threshold) || 0.99 },
      { timeout: 300000 }
    );
    res.json(response.data);
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return res.status(503).json({ error: 'Proxy analysis service is unavailable' });
    }
    console.error('proxy-analysis exact-duplicates error:', err.message);
    res.status(502).json({ error: `Exact-duplicate detection failed: ${err.message}` });
  }
});

// POST /exact-duplicates-stream - SSE streaming variant with per-group progress
router.post('/exact-duplicates-stream', async (req, res) => {
  const { groups, include_near, near_threshold } = req.body;

  if (!Array.isArray(groups)) {
    return res.status(400).json({ error: 'groups array is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    const response = await axios.post(
      `${PROXY_ANALYSIS_URL}/exact-duplicates-stream`,
      { groups, include_near: !!include_near, near_threshold: Number(near_threshold) || 0.99 },
      { responseType: 'stream', timeout: 600000 }
    );

    response.data.pipe(res);

    req.on('close', () => {
      response.data.destroy();
    });
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      res.write(`data: ${JSON.stringify({ phase: 'error', message: 'Proxy analysis service is unavailable' })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ phase: 'error', message: err.message })}\n\n`);
    }
    res.end();
  }
});

// GET /compilation-metadata - Proxy lipdverse compilation version dates
// (cached in-memory for the life of the process — the file changes rarely).
let _compilationMetaCache = null;
let _compilationMetaCacheAt = 0;
router.get('/compilation-metadata', async (req, res) => {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  if (_compilationMetaCache && (now - _compilationMetaCacheAt) < ONE_HOUR) {
    return res.json(_compilationMetaCache);
  }
  try {
    const response = await axios.get(
      'https://lipdverse.org/lipdverse/compilationMetadata.json',
      { timeout: 15000 }
    );
    _compilationMetaCache = response.data;
    _compilationMetaCacheAt = now;
    res.json(_compilationMetaCache);
  } catch (err) {
    console.error('compilation-metadata fetch error:', err.message);
    res.status(502).json({ error: 'Failed to fetch compilation metadata' });
  }
});

// GET /preload-status - Return which TSIDs are already cached (for ready indicators)
router.get('/preload-status', async (req, res) => {
  try {
    const response = await axios.get(`${PROXY_ANALYSIS_URL}/preload-status`, { timeout: 5000 });
    res.json(response.data);
  } catch (err) {
    // Non-fatal — client just won't update ready badges until next poll
    res.json({ readyTsids: [] });
  }
});

// POST /save-progress - Persist keep/remove state + notes and email the user a resume link
router.post('/save-progress', async (req, res) => {
  const { uniqueID, recon, urlParams, excludedTSIDs, excludedVariableNames, groupNotes } = req.body;

  if (!uniqueID || !recon) {
    return res.status(400).json({ error: 'uniqueID and recon are required' });
  }

  const userReconDir = path.join(config.paths.userRecons, `${uniqueID}_${recon}`);
  if (!fs.existsSync(userReconDir)) {
    return res.status(404).json({ error: 'Session not found — uniqueID may have expired' });
  }

  const progress = {
    urlParams:             typeof urlParams === 'string' ? urlParams : '',
    excludedTSIDs:         Array.isArray(excludedTSIDs) ? excludedTSIDs : [],
    excludedVariableNames: Array.isArray(excludedVariableNames) ? excludedVariableNames : [],
    groupNotes:            (groupNotes && typeof groupNotes === 'object') ? groupNotes : {},
    savedAt:               new Date().toISOString(),
  };

  try {
    fs.writeFileSync(path.join(userReconDir, 'progress.json'), JSON.stringify(progress, null, 2));
  } catch (err) {
    console.error('Failed to write progress.json:', err);
    return res.status(500).json({ error: 'Failed to save progress' });
  }

  res.json({ success: true });
});

// GET /progress - Return saved progress if it exists
router.get('/progress', (req, res) => {
  const { uniqueID, recon } = req.query;
  if (!uniqueID || !recon) return res.status(400).json({ error: 'uniqueID and recon required' });

  const progressPath = path.join(config.paths.userRecons, `${uniqueID}_${recon}`, 'progress.json');
  if (!fs.existsSync(progressPath)) return res.json(null);

  try {
    res.json(JSON.parse(fs.readFileSync(progressPath, 'utf8')));
  } catch {
    res.json(null);
  }
});

// POST /email-progress - Send the user a resume link via email
router.post('/email-progress', async (req, res) => {
  const { uniqueID, recon, email, resumeUrl } = req.body;

  if (!uniqueID || !recon || !email || !resumeUrl) {
    return res.status(400).json({ error: 'uniqueID, recon, email, and resumeUrl are required' });
  }

  // Basic email validation
  if (!email.includes('@') || !email.includes('.')) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host:   config.smtp.host,
      port:   config.smtp.port,
      secure: config.smtp.port === 465,
      auth:   { user: config.smtp.user, pass: config.smtp.password },
    });

    await transporter.sendMail({
      from:    config.smtp.user,
      to:      email,
      subject: 'Your Presto data cleaning progress',
      html: `
        <p>Here is your resume link for the Presto data cleaning session:</p>
        <p><a href="${resumeUrl}">${resumeUrl}</a></p>
        <p style="color:#888;font-size:0.85em;">
          This link will restore your Keep / Remove selections and any notes you added.
          Session data is retained for <strong>30 days</strong>, so this link will remain
          valid until then.
        </p>
      `,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('email-progress send error:', err.message);
    res.status(500).json({ error: 'Failed to send email: ' + err.message });
  }
});

// POST /confirm - Save cleaned TSID selection, return redirect URL
router.post('/confirm', (req, res) => {
  const {
    uniqueID, recon, keptTSIDs, removedTSIDs, groupNotes, cleaningGroups,
    variableFilterExcluded, excludedVariableKeys, includedVariableKeys,
  } = req.body;

  if (!uniqueID || !recon || !Array.isArray(keptTSIDs)) {
    return res.status(400).json({ error: 'uniqueID, recon, and keptTSIDs array are required' });
  }

  const userReconDir = path.join(config.paths.userRecons, `${uniqueID}_${recon}`);
  const cleanedPath = path.join(userReconDir, 'cleaned_TSIDs.json');

  try {
    // Merge variable-filter-excluded TSIDs into the single removedTSIDs list
    // so every downstream consumer (editor.js → lipdQueryJson → template)
    // sees one unified exclusion set.
    const vfExcluded = Array.isArray(variableFilterExcluded) ? variableFilterExcluded : [];
    const vfTsids = vfExcluded.map(e => e && e.tsid).filter(Boolean);
    const mergedRemoved = Array.from(new Set([
      ...(Array.isArray(removedTSIDs) ? removedTSIDs : []),
      ...vfTsids,
    ]));

    const payload = { TSIDs: keptTSIDs };
    if (mergedRemoved.length > 0) payload.removedTSIDs = mergedRemoved;
    if (vfTsids.length > 0) payload.variableFilterRemovedTSIDs = vfTsids;
    if (groupNotes && typeof groupNotes === 'object') {
      // Only persist non-empty notes
      const notes = Object.fromEntries(
        Object.entries(groupNotes).filter(([, v]) => typeof v === 'string' && v.trim())
      );
      if (Object.keys(notes).length > 0) payload.groupNotes = notes;
    }
    fs.writeFileSync(cleanedPath, JSON.stringify(payload, null, 2));
    console.log(`Saved cleaned_TSIDs.json: ${keptTSIDs.length} TSIDs for ${uniqueID}_${recon} (${vfTsids.length} excluded by variable filter)`);

    // Save per-group cleaning report (for inclusion in the repo)
    if (Array.isArray(cleaningGroups) && cleaningGroups.length > 0) {
      const reportPath = path.join(userReconDir, 'cleaning_report.json');
      fs.writeFileSync(reportPath, JSON.stringify(cleaningGroups, null, 2));
      console.log(`Saved cleaning_report.json: ${cleaningGroups.length} groups for ${uniqueID}_${recon}`);
    }

    // Write variable_filter.yaml describing the variable-filter decision so
    // the LMR / holocene_da workflows can inspect it. One file per recon dir;
    // committed to the user's repo by github.js.
    const excluded = Array.isArray(excludedVariableKeys) ? excludedVariableKeys : [];
    const included = Array.isArray(includedVariableKeys) ? includedVariableKeys : [];
    // Group excluded TSIDs by variableName for a readable YAML.
    const excludedByVariable = {};
    for (const e of vfExcluded) {
      if (!e || !e.tsid) continue;
      const k = (e.filterKey || e.variableName || 'unknown').toString();
      if (!excludedByVariable[k]) excludedByVariable[k] = [];
      excludedByVariable[k].push(e.tsid);
    }
    const variableFilter = {
      // Filter keys the user (or default blacklist) marked as excluded. These
      // are lowercased variableName values, with two synthetic keys for
      // thickness: `thickness:annual` (resolution ≤ 1 yr, varves) and
      // `thickness:nonannual` (all other thickness rows).
      excluded_variable_keys: excluded,
      // Filter keys that are present in the record set AND included (i.e.,
      // contributed TSIDs to the kept set). Useful for downstream sanity checks.
      included_variable_keys: included,
      // TSIDs dropped purely by the variable filter, grouped by filter key.
      // These are a subset of `removedTSIDs` in cleaned_TSIDs.json.
      excluded_tsids_by_variable: excludedByVariable,
      // Total TSIDs removed by the variable filter (sum across groups above).
      excluded_tsid_count: vfTsids.length,
    };
    const yamlStr =
      '# Variable filter decisions from the Presto data cleaning page.\n' +
      '# Generated automatically when the user clicks Continue.\n' +
      '#\n' +
      '# thickness:annual     = varve thickness rows with median resolution <= 1 yr\n' +
      '# thickness:nonannual  = all other thickness rows\n' +
      '#\n' +
      YAML.stringify(variableFilter);
    fs.writeFileSync(path.join(userReconDir, 'variable_filter.yaml'), yamlStr);
    console.log(`Saved variable_filter.yaml: ${excluded.length} excluded keys, ${included.length} included keys`);

    res.json({ success: true, keptCount: keptTSIDs.length });
  } catch (err) {
    console.error('Failed to write cleaned_TSIDs.json:', err);
    res.status(500).json({ error: 'Failed to save selection' });
  }
});

module.exports = router;
