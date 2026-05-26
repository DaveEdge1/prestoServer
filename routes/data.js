/**
 * Data routes (was queryDB.js)
 * MySQL database queries for LiPDverse data
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const config = require('../config');

// Cache for full dataset query (24 hour TTL)
let datasetCache = {
  data: null,
  timestamp: null,
  ttl: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
};

// Single shared connection pool. Created once at module load. The old
// per-request `getPool()` exhausted MySQL's max_connections under load —
// each /data hit was creating a brand-new pool with its own backlog of
// idle connections that never returned to MySQL until pool GC'd.
const pool = mysql.createPool({
  connectionLimit: config.mysql.connectionLimit,
  host: config.mysql.host,
  user: config.mysql.user,
  password: config.mysql.password,
  database: config.mysql.database,
});

// Per-recon predicate defining what counts as a "real" proxy in the
// reconstruction loader's eyes. Used by computeTsidComplement to find
// sibling TSIDs that would otherwise ride along inside the parent .lpd
// files. Missing key → no complement is computed (legacy behavior).
const RECON_PREDICATES = {
  holocene_da: { unitsEq: 'degC' },
  // LMR / lipd-downloads: wire when ready.
};

// Columns the query UI is allowed to filter on. The previous implementation
// interpolated raw user input from query-string keys directly into SQL, so
// a request like `?DROP TABLE foo;--` would land verbatim in the statement.
// The whitelist below + parameterized values together close that hole while
// preserving the UI's existing call patterns (see query/public/queryHelpers.js).
const ALLOWED_COLUMNS = new Set([
  // LIKE / equality filters
  'archiveType',
  'compilation',
  'continent',
  'country',
  'dataSetName',
  'datasetId',
  'interp_Vars',
  'paleoData_mostRecentCompilations',
  'paleoData_proxy',
  'paleoData_TSid',
  'paleoData_units',
  'paleoData_variableName',
  'seasonality',
  // Numeric / range filters (used in `<col> <op> <num>` expressions)
  'geo_latitude',
  'geo_longitude',
  'maxAge',
  'medianResolution',
  'minAge',
]);

// Bare column name (LIKE-filter key, value carries the match terms)
const COL_RE = /^([a-zA-Z_][a-zA-Z0-9_]*)$/;
// Comparison expression with no '=' sign — the UI encodes these as a
// querystring key with empty value:
//   ?maxAge > 99
//   ?maxAge - minAge > 99
//   ?geo_latitude < 30
// Only '<' and '>' are accepted; the UI rewrites >= and <= to > N-1 / < N+1
// to avoid putting '=' into a URL key (which the querystring parser would
// treat as the key/value separator).
const CMP_RE = /^([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*([+\-])\s*([a-zA-Z_][a-zA-Z0-9_]*))?\s*([<>])\s*(-?\d+(?:\.\d+)?)$/;

/**
 * Build a parameterized WHERE clause from the request's query string.
 *
 * Returns `{ sql, params }`. `sql` is either '' (no clause) or begins
 * with ' WHERE '. `params` are the values to bind into '?' placeholders
 * via pool.query(sql, params, cb).
 *
 * Any key/value pair that doesn't match a whitelisted shape is silently
 * dropped — a strict regex + column whitelist gives us two redundant
 * checks against injection.
 */
function buildQstring(qs) {
  const clauses = [];
  const params = [];

  for (const [key, rawValue] of Object.entries(qs)) {
    // Reject array / nested-object values (?col[]=x or ?col[sub]=x).
    // The UI never sends these; they only show up from attackers
    // probing for buggy parsers.
    const value = typeof rawValue === 'string' ? rawValue : '';

    if (value.length > 0) {
      // ── LIKE filter: ?col=val1,val2 → (col LIKE ? OR col LIKE ?) ──
      const m = key.match(COL_RE);
      if (!m || !ALLOWED_COLUMNS.has(m[1])) continue;
      const col = m[1];
      const vals = value.split(',').map(v => v.trim()).filter(Boolean);
      if (vals.length === 0) continue;
      // The upstream lipdverseQuery.csv started storing multi-word
      // continents with a space ("North America") where they used to
      // be camelCase ("NorthAmerica"). The frontend autocomplete and
      // existing bookmarks still send the camelCase form, so strip
      // spaces on both sides of the LIKE comparison for `continent`
      // to keep both formats matching. Other text columns don't
      // have this collision, so the unconditional path stays.
      if (col === 'continent') {
        clauses.push('(' + vals.map(() => `REPLACE(${col}, ' ', '') LIKE ?`).join(' OR ') + ')');
        vals.forEach(v => params.push('%' + v.replace(/ /g, '') + '%'));
      } else {
        clauses.push('(' + vals.map(() => `${col} LIKE ?`).join(' OR ') + ')');
        vals.forEach(v => params.push('%' + v + '%'));
      }
    } else {
      // ── Comparison expression: ?col [+-] col <op> num ──
      const m = key.match(CMP_RE);
      if (!m) continue;
      const [, col1, op2, col2, cmp, numStr] = m;
      if (!ALLOWED_COLUMNS.has(col1)) continue;
      if (col2 && !ALLOWED_COLUMNS.has(col2)) continue;
      const num = parseFloat(numStr);
      if (!Number.isFinite(num)) continue;
      const lhs = col2 ? `${col1} ${op2} ${col2}` : col1;
      clauses.push(`(${lhs} ${cmp} ?)`);
      params.push(num);
    }
  }

  if (clauses.length === 0) return { sql: '', params: [] };
  return { sql: ' WHERE ' + clauses.join(' AND '), params };
}

// GET / - Query dataset summary
router.get('/', (req, res) => {
  const hasQueryParams = Object.keys(req.query).length > 0;
  const now = Date.now();

  // Use cache for full dataset query (no filters)
  if (!hasQueryParams && datasetCache.data && datasetCache.timestamp) {
    const cacheAge = now - datasetCache.timestamp;
    if (cacheAge < datasetCache.ttl) {
      console.log(`Serving from cache (age: ${Math.round(cacheAge / 1000 / 60)} minutes)`);
      return res.status(200).json(datasetCache.data);
    } else {
      console.log('Cache expired, refreshing...');
    }
  }

  const { sql, params } = buildQstring(req.query);
  const query = 'SELECT dataSetName, archiveType, geo_latitude, geo_longitude, paleoData_proxy, minAge, maxAge, datasetId, interp_Vars FROM dataSetQuery' + sql + ';';
  pool.query(query, params, (err, result) => {
    if (err) {
      console.error('Query error:', err);
      return res.status(500).json({ error: 'Query failed' });
    }
    console.log('Total records returned: ' + result.length);

    // Cache the full dataset query (no filters)
    if (!hasQueryParams) {
      datasetCache.data = result;
      datasetCache.timestamp = now;
      console.log('Dataset cached for 24 hours');
    }

    res.status(200).json(result);
  });
});

// GET /TS - Query time series
router.get('/TS', (req, res) => {
  const { sql, params } = buildQstring(req.query);
  const query = 'SELECT paleoData_TSid, datasetId FROM query' + sql + ';';
  pool.query(query, params, (err, result) => {
    if (err) {
      console.error('Query error:', err);
      return res.status(500).json({ error: 'Query failed' });
    }
    console.log('Total records returned: ' + result.length);
    res.status(200).json(result);
  });
});

/**
 * Given a set of selected TSIDs and a recon type, return the TSIDs that share
 * a parent dataset with the selection, match the recon's "is a proxy"
 * predicate, and are not themselves in the selection. These are the TSIDs
 * that would ride along inside the .lpd files lipdGenerator downloads and
 * need stripping via removedTsids before pickle generation.
 *
 * Resolves to { complement: [], stats: null } if the recon has no predicate
 * registered, so callers don't need to special-case unconfigured recons.
 */
async function computeTsidComplement(tsids, recon) {
  const pred = RECON_PREDICATES[recon];
  if (!pred || !Array.isArray(tsids) || tsids.length === 0) {
    return { complement: [], stats: null };
  }
  const placeholders = tsids.map(() => '?').join(',');
  // COLLATE utf8mb4_bin: the query table's text columns default to a
  // case-insensitive collation; force a binary match so TSIDs that differ
  // only in case don't silently widen the IN-set.
  const sql =
    `SELECT DISTINCT q2.paleoData_TSid AS tsid, q1.paleoData_TSid AS seed
       FROM query q1
       JOIN query q2 ON q1.datasetId = q2.datasetId
      WHERE q1.paleoData_TSid COLLATE utf8mb4_bin IN (${placeholders})
        AND q2.paleoData_units = ?`;
  const params = [...tsids, pred.unitsEq];
  const [rows] = await pool.promise().query(sql, params);

  const seeds = new Set(rows.map(r => r.seed));
  const keptSet = new Set(tsids);
  const universeSet = new Set(rows.map(r => r.tsid));
  const complement = [...universeSet].filter(t => !keptSet.has(t));

  if (seeds.size < tsids.length) {
    console.warn(
      `computeTsidComplement: ${tsids.length - seeds.size} of ${tsids.length} ` +
      `selected TSIDs not found in query table (recon=${recon}); their ` +
      `parent datasets cannot contribute to the complement.`
    );
  }
  return {
    complement,
    stats: {
      matched: seeds.size,
      universe: universeSet.size,
      complement: complement.length,
    },
  };
}

module.exports = { router, computeTsidComplement, RECON_PREDICATES };
