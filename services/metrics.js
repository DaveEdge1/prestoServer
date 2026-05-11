/**
 * Prometheus metrics for the orchestrator.
 *
 * Exposes a singleton `register` plus pre-built collectors that the rest
 * of the app can import without re-creating metrics (prom-client throws
 * on duplicate registration). Default Node process metrics — heap, GC,
 * event loop lag, file descriptors — are enabled here so the dashboard
 * has them out of the box.
 */

const promClient = require('prom-client');

const register = new promClient.Registry();
register.setDefaultLabels({ service: 'presto-orchestrator' });

promClient.collectDefaultMetrics({
  register,
  // Sample every 10s — matches Prometheus scrape interval.
  prefix: 'presto_',
});

const httpRequestDuration = new promClient.Histogram({
  name: 'presto_http_request_duration_seconds',
  help: 'HTTP request latency in seconds, labeled by route and status.',
  labelNames: ['method', 'route', 'status'],
  // Buckets tuned for a mix of fast (form/static) and slow (analyze, recon) routes.
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300, 600],
  registers: [register],
});

const httpRequestsTotal = new promClient.Counter({
  name: 'presto_http_requests_total',
  help: 'Total HTTP requests received.',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

const httpRequestsInFlight = new promClient.Gauge({
  name: 'presto_http_requests_in_flight',
  help: 'In-flight HTTP requests.',
  labelNames: ['method'],
  registers: [register],
});

/**
 * Express middleware that records timing/count for every request. Mount
 * before route handlers so it sees the matched route on `req.route.path`.
 */
function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  httpRequestsInFlight.inc({ method: req.method });

  res.on('finish', () => {
    const elapsedNs = Number(process.hrtime.bigint() - start);
    const seconds = elapsedNs / 1e9;
    // req.route is only populated if the request matched a route handler.
    // Fall back to the URL path so 404s/errors are still labeled.
    const route = (req.route && req.route.path) || req.baseUrl || req.path || 'unknown';
    const labels = {
      method: req.method,
      route,
      status: String(res.statusCode),
    };
    httpRequestDuration.observe(labels, seconds);
    httpRequestsTotal.inc(labels);
    httpRequestsInFlight.dec({ method: req.method });
  });

  next();
}

module.exports = {
  register,
  metricsMiddleware,
  httpRequestDuration,
  httpRequestsTotal,
  httpRequestsInFlight,
};
