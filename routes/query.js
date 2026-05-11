/**
 * Query routes (was queryServer.js)
 * Query interface for selecting LiPDverse data
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const queryDir = path.join(__dirname, '..', 'query');

// Page-specific configuration injected into the unified query.html template
// timeSlider range is in yr BP (BP = years before 1950 AD).
//   min: -70  ⇒ year 2020 AD  (allows recent records past 1950)
//   max: 1950 ⇒ year   0 AD   (= 1 BCE) for LMR
//   max: 9950 ⇒ year 8000 BCE for Holocene DA / Downloads
const PAGE_CONFIGS = {
  LMR: {
    defaultMode: 'archive',
    archivedCompilation: { name: 'Pages2kTemperature', version: '2_2_0' },
    compilationFilter: 'Pages2k',
    interpVarDefault: 'temperature',
    extendBackDefault: 100,
    timeSlider: { min: -70, max: 1950, step: 10 },
  },
  holocene_da: {
    defaultMode: 'archive',
    archivedCompilation: { name: 'Temp12k', version: '1_0_2' },
    compilationFilter: 'Temp12k-1_2_0',
    interpVarDefault: 'temperature',
    minRecordLength: 100,
    timeSlider: { min: -70, max: 9950, step: 10 },
  },
  download: {
    defaultMode: 'query',
    archivedCompilation: { name: '', version: '' },
    compilationFilter: '',
    timeSlider: { min: -70, max: 9950, step: 10 },
  },
  downloadNew: {
    defaultMode: 'query',
    archivedCompilation: { name: '', version: '' },
    compilationFilter: '',
    timeSlider: { min: -70, max: 9950, step: 10 },
  }
};

// Read the unified template once at startup
const queryTemplate = fs.readFileSync(path.join(queryDir, 'query.html'), 'utf8');

// Index PAGE_CONFIGS by lowercased recon name so URLs like /query/lmr,
// /query/LMR, and /query/Lmr all resolve to the same config. Without this,
// the bare {recon} param lookup is case-sensitive and only the exact-case
// keys (LMR, holocene_da, ...) work — anything else falls through to the
// static-file fallback, which 500s when no matching .html exists.
const PAGE_CONFIG_BY_LOWER = Object.fromEntries(
  Object.entries(PAGE_CONFIGS).map(([k, v]) => [k.toLowerCase(), v])
);

// Serve static files from query/public
router.use('/', express.static(path.join(queryDir, 'public')));

// GET / - Main query index
router.get('/', (req, res) => {
  res.sendFile(path.join(queryDir, 'index.html'));
});

// GET /:recon - Reconstruction-specific query page (unified template)
router.get('/:recon', (req, res) => {
  const recon = req.params.recon;
  const config = PAGE_CONFIG_BY_LOWER[recon.toLowerCase()];

  if (config) {
    // Serve unified template with injected config
    const html = queryTemplate.replace(
      '<!--PAGE_CONFIG-->',
      `<script>var PAGE_CONFIG = ${JSON.stringify(config)};</script>`
    );
    res.type('html').send(html);
  } else {
    // Fallback: serve static file if it exists (for other pages like datacleaning, etc.)
    const fileLoc = path.join(queryDir, recon + '.html');
    console.log('serving file: ' + fileLoc);
    res.sendFile(fileLoc);
  }
});

// GET /paleoPlots/:datasetId - Redirect to the correct versioned paleoPlots URL
router.get('/paleoPlots/:datasetId', async (req, res) => {
  try {
    const dsId = req.params.datasetId;
    const resp = await fetch(`https://lipdverse.org/data/${dsId}/`);
    const html = await resp.text();
    const match = html.match(/url='([^']+)\/index\.html'/);
    if (match) {
      res.redirect(`https://lipdverse.org/data/${dsId}/${match[1]}/paleoPlots.html`);
    } else {
      res.status(404).send('Plot not found');
    }
  } catch (err) {
    console.error('paleoPlots redirect error:', err);
    res.status(500).send('Error resolving plot URL');
  }
});

// POST /lipdVerse - Echo back query data (for debugging)
router.post('/lipdVerse', (req, res) => {
  console.log(req.body);
  res.send(req.body);
});

module.exports = router;
