/**
 * Query routes (was queryServer.js)
 * Query interface for selecting LiPDverse data
 */

const express = require('express');
const router = express.Router();
const path = require('path');

const queryDir = path.join(__dirname, '..', 'query');

// Serve static files from query/public
router.use('/', express.static(path.join(queryDir, 'public')));

// GET / - Main query index
router.get('/', (req, res) => {
  res.sendFile(path.join(queryDir, 'index.html'));
});

// GET /:recon - Reconstruction-specific query page
router.get('/:recon', (req, res) => {
  const fileName1 = req.params.recon + '.html';
  const fileLoc = path.join(queryDir, fileName1);
  console.log('serving file: ' + fileLoc);
  res.sendFile(fileLoc);
});

// POST /lipdVerse - Echo back query data (for debugging)
router.post('/lipdVerse', (req, res) => {
  console.log(req.body);
  res.send(req.body);
});

module.exports = router;
