/**
 * Centralized configuration for Presto server
 * All environment-dependent values should be defined here
 */

const config = {
  // Server
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Base URL for redirects and links (no trailing slash)
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',

  // SMTP Configuration
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.zoho.com',
    port: parseInt(process.env.SMTP_PORT) || 465,
    user: process.env.SMTP_USER || 'no-reply@paleopresto.com',
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM || 'no-reply@paleopresto.com'
  },

  // MySQL Configuration
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'dave',
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || 'lipdverse',
    connectionLimit: 100
  },

  // External Services
  graphDbUrl: process.env.GRAPHDB_URL || 'https://linkedearth.graphdb.mint.isi.edu',

  // GitHub OAuth & Actions Configuration
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
    defaultVisibility: process.env.GITHUB_DEFAULT_VISIBILITY || 'public',
    callbackUrl: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/oauth/github/callback'
  },

  // Security
  encryptionKey: process.env.ENCRYPTION_KEY,
  sessionSecret: process.env.SESSION_SECRET || 'presto-session-secret-change-in-production',

  // File Paths (for production Linux server)
  paths: {
    userRecons: process.env.USER_RECONS_PATH || '/root/presto/userRecons',
    prestoForm: process.env.PRESTO_FORM_PATH || '/root/presto/prestoForm',
    prestoBase: process.env.PRESTO_BASE_PATH || '/root/presto',
    holoceneDa: process.env.HOLOCENE_DA_PATH || '/root/holocene_da',
    temp12k: process.env.TEMP12K_PATH || '/root/temp12k-regional-composites'
  },

  // CORS origins (comma-separated in env var)
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:3000']
};

module.exports = config;
