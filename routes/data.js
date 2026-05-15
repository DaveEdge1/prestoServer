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

// Build WHERE clause from query parameters
function buildQstring(qs) {
  let countA = 0;
  console.log(qs);
  console.log('key length: ' + Object.keys(qs).length);

  if (Object.keys(qs).length === 0) {
    console.log('mySQL string is empty');
    return '';
  }

  let outString = '';
  for (const [key, value] of Object.entries(qs)) {
    const words = value.split(',');
    console.log('words: ' + words);
    const totalWordLen = words.reduce((a, obj) => a + Object.keys(obj).length, 0);
    console.log(totalWordLen);

    if (countA > 0) {
      console.log('index > 0');
      outString = outString + ' AND (';
    } else {
      outString = '(';
    }

    if (totalWordLen == 0) {
      outString = outString + key;
    } else {
      for (let i = 0; i < words.length; i++) {
        outString = outString + key + ' LIKE' + ' "%' + words[i] + '%"';
        if (i < words.length - 1) {
          outString = outString + ' OR ';
        }
      }
    }

    outString = outString + ')';
    console.log('outString: ' + outString);
    countA = countA + 1;
  }

  outString = ' WHERE ' + outString;
  console.log('mySQL string: ' + outString);
  return outString;
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

  const query = 'SELECT dataSetName, archiveType, geo_latitude, geo_longitude, paleoData_proxy, minAge, maxAge, datasetId, interp_Vars FROM dataSetQuery' + buildQstring(req.query) + ';';
  pool.query(query, (err, result) => {
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
  const query = 'SELECT paleoData_TSid, datasetId FROM query' + buildQstring(req.query) + ';';
  pool.query(query, (err, result) => {
    if (err) {
      console.error('Query error:', err);
      return res.status(500).json({ error: 'Query failed' });
    }
    console.log('Total records returned: ' + result.length);
    res.status(200).json(result);
  });
});

module.exports = router;
