/**
 * Downloads routes (was downloadServer.js)
 * Serves user reconstruction files and downloads
 */

const express = require('express');
const router = express.Router();
const serveIndex = require('serve-index');
const path = require('path');
const config = require('../config');

// Browse user reconstructions directory
router.use('/browse',
  express.static(config.paths.userRecons),
  serveIndex(config.paths.userRecons, { icons: true, view: 'details' })
);

// Download zip file by ID
router.get('/zip/:downloadId', (req, res) => {
  const zipPath = path.join(config.paths.userRecons, req.params.downloadId + '.zip');
  res.download(zipPath);
});

// Get download path info
router.get('/:downloadId', (req, res) => {
  res.send('/downloads/browse/' + req.params.downloadId);
});

module.exports = router;
