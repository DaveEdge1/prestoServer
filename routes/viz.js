/**
 * Visualization routes (was viz.js)
 * Serves visualization pages for completed reconstructions
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const config = require('../config');

// Serve visualization for a reconstruction
router.get('/:reconID', (req, res) => {
  const vizDir = path.join(config.paths.userRecons, req.params.reconID, 'viz');

  // Serve static files from viz directory
  express.static(vizDir)(req, res, () => {
    // If static middleware doesn't handle it, send the visualizer.html
    res.sendFile(path.join(vizDir, 'visualizer.html'));
  });
});

// Serve static assets within viz directory
router.use('/:reconID', (req, res, next) => {
  const vizDir = path.join(config.paths.userRecons, req.params.reconID, 'viz');
  express.static(vizDir)(req, res, next);
});

module.exports = router;
