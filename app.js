/**
 * Presto Server - Consolidated Express Application
 *
 * This consolidates 9 separate servers into a single application:
 * - prestoServer (reconstruct)
 * - downloadServer (downloads)
 * - formServer (forms)
 * - editorServer (editor)
 * - queryServer + queryDB (query, data)
 * - sparqlServer (sparql)
 * - Rserver (lipds)
 * - viz (viz)
 */

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const app = express();

// ===========================================
// MIDDLEWARE
// ===========================================

// CORS configuration
app.use(cors({
  origin: config.corsOrigins
}));

// Body parsing
app.use(bodyParser.json({
  parameterLimit: 100000,
  limit: '50mb'
}));
app.use(bodyParser.urlencoded({ extended: true }));

// Trust proxy (for req.ip behind nginx)
app.set('trust proxy', true);

// EJS view engine (for forms)
app.set('views', path.join(__dirname, 'prestoForm', 'views'));
app.set('view engine', 'ejs');

// ===========================================
// ROUTES
// ===========================================

// Reconstruction trigger (was prestoServer:3000)
app.use('/reconstruct', require('./routes/reconstruct'));

// File downloads (was downloadServer:3001)
app.use('/downloads', require('./routes/downloads'));

// Configuration forms (was formServer:3002)
app.use('/forms', require('./routes/forms'));

// Parameter editor (was editorServer:3004)
app.use('/editor', require('./routes/editor'));

// Query interface (was queryServer:3006)
app.use('/query', require('./routes/query'));

// Database queries (was queryDB:3007)
app.use('/data', require('./routes/data'));

// SPARQL queries (was sparqlServer:3009)
app.use('/sparql', require('./routes/sparql'));

// LiPD data management (was Rserver:3010)
app.use('/lipds', require('./routes/lipds'));

// Visualization (was viz:3011)
app.use('/viz', require('./routes/viz'));

// Post TSIDs (was postTSidsServer:3012)
app.use('/posttsids', require('./routes/posttsids'));

// ===========================================
// HEALTH CHECK
// ===========================================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// Root redirect to forms
app.get('/', (req, res) => {
  res.redirect('/forms');
});

// ===========================================
// ERROR HANDLING
// ===========================================

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ===========================================
// START SERVER
// ===========================================

app.listen(config.port, () => {
  console.log(`Presto server listening on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Base URL: ${config.baseUrl}`);
});

module.exports = app;
