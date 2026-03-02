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

// POST /confirm - Save cleaned TSID selection, return redirect URL
router.post('/confirm', (req, res) => {
  const { uniqueID, recon, keptTSIDs } = req.body;

  if (!uniqueID || !recon || !Array.isArray(keptTSIDs)) {
    return res.status(400).json({ error: 'uniqueID, recon, and keptTSIDs array are required' });
  }

  const userReconDir = path.join(config.paths.userRecons, `${uniqueID}_${recon}`);
  const cleanedPath = path.join(userReconDir, 'cleaned_TSIDs.json');

  try {
    fs.writeFileSync(cleanedPath, JSON.stringify({ TSIDs: keptTSIDs }, null, 2));
    console.log(`Saved cleaned_TSIDs.json: ${keptTSIDs.length} TSIDs for ${uniqueID}_${recon}`);
    res.json({ success: true, keptCount: keptTSIDs.length });
  } catch (err) {
    console.error('Failed to write cleaned_TSIDs.json:', err);
    res.status(500).json({ error: 'Failed to save selection' });
  }
});

module.exports = router;
