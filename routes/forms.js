/**
 * Forms routes (was formServer.js)
 * Configuration forms and the reconstruction-method picker feed.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const reconRegistry = require('../presto/reconRegistry');

const formDir = path.join(__dirname, '..', 'prestoForm');

// EJS helpers (kept for any view that requires them at load time)
const ejs_helpers = require(path.join(formDir, 'helpers.js'));

// Serve static files from prestoForm/public
router.use('/', express.static(path.join(formDir, 'public')));

// GET /down - Maintenance page
router.get('/down', (req, res) => {
  res.send(
    "Sorry, the Presto Custom Recontruction Engine is currently down for maintenance.<br>We'll be back soon!.<br><br><br>" +
    '<a href="https://paleopresto.com/" target="_blank"><img src="https://paleopresto.com/img/logo.png" alt="Presto logo" height="50" width="141"></a>'
  );
});

// GET / - Main form page
router.get('/', (req, res) => {
  console.log(req.ip);
  res.sendFile(path.join(formDir, 'index.html'));
});

// GET /recons.json - Enabled reconstruction methods for the picker + comparison
// table on index.html. Sourced from the recon registry (single source of truth),
// so a new method appears here automatically once registered.
router.get('/recons.json', (req, res) => {
  const recons = reconRegistry
    .list({ enabledOnly: true })
    .map(e => Object.assign({ handle: e.handle }, e.ui));
  res.json(recons);
});

// GET /query - Query parameter info
router.get('/query', (req, res) => {
  res.send(req.query.id + '<br>' + req.query.num);
});

// GET /getUserInfo - Get user info form (needed for OAuth callback redirect)
router.get('/getUserInfo', (req, res) => {
  res.sendFile(path.join(formDir, 'index2.html'));
});

// POST /getUserInfo - Get user info form
router.post('/getUserInfo', (req, res) => {
  res.sendFile(path.join(formDir, 'index2.html'));
});

module.exports = router;
