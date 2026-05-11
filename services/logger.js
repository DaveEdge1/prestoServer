/**
 * Shared pino logger for the orchestrator.
 *
 * Emits newline-delimited JSON to stdout so docker's json-file driver
 * captures it; promtail (loadtest/monitoring) tails those container logs
 * and ships them to Loki. Don't pretty-print in production — it breaks
 * structured ingestion.
 *
 * Levels: trace, debug, info, warn, error, fatal.
 * Set LOG_LEVEL to override (default: info).
 */

const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: 'presto-orchestrator',
    env: process.env.NODE_ENV || 'development',
  },
  // ISO timestamps so Loki/Grafana display correctly without conversion.
  timestamp: pino.stdTimeFunctions.isoTime,
  // Redact obvious secrets if they ever sneak into a log line.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
      '*.access_token',
      '*.client_secret',
    ],
    censor: '[REDACTED]',
  },
});

module.exports = logger;
