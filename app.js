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
const session = require('express-session');
const pinoHttp = require('pino-http');
const config = require('./config');
const logger = require('./services/logger');
const { register: metricsRegister, metricsMiddleware } = require('./services/metrics');

// Crash handlers — install before any route work so an early throw still
// gets recorded. Without these, an unhandled rejection can silently kill
// Node and leave docker-compose with no exit reason. Logging then exiting
// lets the restart policy bring us back cleanly with a recorded cause.
process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ err: reason, type: 'unhandledRejection' }, 'unhandled promise rejection');
  // Give the logger a tick to flush, then exit so docker restarts us.
  setTimeout(() => process.exit(1), 100).unref();
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err, type: 'uncaughtException' }, 'uncaught exception');
  setTimeout(() => process.exit(1), 100).unref();
});

const app = express();

// ===========================================
// OBSERVABILITY (must come before routes so it sees every request)
// ===========================================

// Structured request log: one JSON line per request with method, url,
// status, duration. pino-http auto-attaches `req.log` so handlers can
// log additional context against the request.
app.use(pinoHttp({
  logger,
  // Demote successful health checks and metrics scrapes to debug so the
  // signal-to-noise stays sane during load tests.
  customLogLevel(req, res, err) {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    if (req.url === '/health' || req.url === '/metrics') return 'debug';
    return 'info';
  },
}));

// Prometheus request histograms / counters / in-flight gauge.
app.use(metricsMiddleware);

// ===========================================
// MIDDLEWARE
// ===========================================

// CORS configuration
app.use(cors({
  origin: config.corsOrigins,
  credentials: true
}));

// Body parsing
app.use(bodyParser.json({
  parameterLimit: 100000,
  limit: '50mb'
}));
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration
// Note: secure cookies only work over HTTPS. For local dev with http://localhost,
// we need secure: false even if NODE_ENV=production
const isHttps = config.baseUrl && config.baseUrl.startsWith('https://');
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isHttps,  // Only use secure cookies if BASE_URL is HTTPS
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// Trust proxy (for req.ip behind nginx)
app.set('trust proxy', true);

// EJS view engine (for forms)
app.set('views', path.join(__dirname, 'prestoForm', 'views'));
app.set('view engine', 'ejs');

// ===========================================
// ROUTES
// ===========================================

// GitHub OAuth & Integration (new)
app.use('/oauth', require('./routes/oauth'));
app.use('/webhooks', require('./routes/webhooks'));
app.use('/status', require('./routes/status'));

// Serve static files from public directory
app.use('/public', express.static(path.join(__dirname, 'public')));

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
app.use('/data', require('./routes/data').router);

// SPARQL queries (was sparqlServer:3009)
app.use('/sparql', require('./routes/sparql'));

// LiPD data management (was Rserver:3010)
app.use('/lipds', require('./routes/lipds'));

// Data cleaning (between query and editor for filtered TSID path)
app.use('/datacleaning', require('./routes/datacleaning'));

// Reuse a previous reconstruction's artifacts (query_params, cleaned TSIDs, recon config)
app.use('/reuse', require('./routes/reuse'));

// LiPD file download (confirmation + GitHub repo creation)
app.use('/lipd-download', require('./routes/lipdDownload'));

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

// Prometheus scrape target. Internal-only — nginx doesn't proxy it, so
// only containers on presto-network (e.g. prometheus) can reach it.
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metricsRegister.contentType);
    res.end(await metricsRegister.metrics());
  } catch (err) {
    req.log.error({ err }, 'failed to render /metrics');
    res.status(500).end();
  }
});

// Root redirect to forms
app.get('/', (req, res) => {
  res.redirect('/forms');
});

// ===========================================
// ERROR HANDLING
// ===========================================

app.use((err, req, res, next) => {
  // pino-http attached req.log; use it so the error is correlated with
  // the request line via the same reqId.
  (req.log || logger).error({ err }, 'unhandled error in route');
  res.status(500).json({ error: 'Internal server error' });
});

// ===========================================
// START SERVER
// ===========================================

require('./services/cleanup').startCleanupScheduler();
require('./services/compilationUpdater').startCompilationUpdater();

app.listen(config.port, () => {
  logger.info({
    port: config.port,
    env: config.nodeEnv,
    baseUrl: config.baseUrl,
  }, 'presto orchestrator listening');
});

module.exports = app;
