/**
 * Shared MySQL connection pool.
 *
 * Every route module used to call mysql.createPool(config.mysql) itself, each
 * inheriting connectionLimit: 100. Six modules (data, editor, lipdDownload,
 * oauth, status, webhooks) therefore demanded up to ~600 connections against
 * MySQL's default max_connections of 151 — so under concurrency MySQL started
 * refusing connections (ER_CON_COUNT_ERROR) and every DB-backed route failed.
 *
 * One process-wide pool fixes that: the connectionLimit is enforced once.
 *   - `pool`        : callback-style mysql2 pool (used by routes/data.js)
 *   - `promisePool` : the mysql2/promise wrapper over the SAME underlying pool
 *                     (used by the await-style consumers). .promise() shares
 *                     the connection pool, so the limit is shared, not doubled.
 */

const mysql = require('mysql2');
const config = require('../config');

const pool = mysql.createPool(config.mysql);
const promisePool = pool.promise();

module.exports = { pool, promisePool };
