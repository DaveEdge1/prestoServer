#!/usr/bin/env node
/**
 * Local primary-proxy column updater.
 *
 * For every distinct (datasetId, dataSetName, datasetVersion) triple in the
 * MySQL `query` table, download the dataset's .lpd from
 *   https://lipdverse.org/data/{datasetId}/{version}/{dataSetName}.lpd
 * extract `bag/data/metadata.jsonld`, walk paleoData->measurementTable->columns,
 * and collect per-TSID `useInGlobalTemperatureAnalysis` (string). Then ALTER
 * TABLE to add the column if missing and UPDATE every matching row.
 *
 * We formerly also populated `inCompilationBeta`, but that signal is already
 * captured by `paleoData_mostRecentCompilations` which ships in the upstream
 * lipdverse query CSV — so the enrichment for compilation membership was
 * retired. The column, if present from a prior run, is left as-is and simply
 * ignored; TRUNCATE of the query table on the next CSV reload will clear it.
 *
 * Run: docker exec prestoserver-presto-orchestrator-1 node scripts/updatePrimaryProxyColumns.js
 */

'use strict';

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');
const mysql = require('mysql2/promise');

const execFileP = promisify(execFile);

const CONCURRENCY    = 20;
const WORK_DIR       = '/tmp/lipdverse_primary';
const BATCH_SIZE     = 1000;
const AXIOS_TIMEOUT  = 30000;

function dbConfig() {
  return {
    host:     process.env.MYSQL_HOST     || 'mysql',
    user:     process.env.MYSQL_USER     || 'dave',
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || 'lipdverse',
  };
}

// --- Helpers -----------------------------------------------------------------

function versionDotsToUnderscores(v) {
  return String(v || '').replace(/\./g, '_');
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

// Extract bag/data/metadata.jsonld bytes from an .lpd zipfile without writing
// to disk. Uses `unzip -p` for streaming-to-stdout.
async function extractMetadata(lpdPath) {
  const { stdout } = await execFileP(
    'unzip', ['-p', lpdPath, 'bag/data/metadata.jsonld'],
    { maxBuffer: 32 * 1024 * 1024 }
  );
  return JSON.parse(stdout);
}

// Build per-TSID primary-proxy flags from a parsed metadata object.
function collectTsidFlags(meta, intoMap) {
  const pd = Array.isArray(meta?.paleoData) ? meta.paleoData : [];
  for (const p of pd) {
    const tables = Array.isArray(p?.measurementTable) ? p.measurementTable : [];
    for (const t of tables) {
      const cols = Array.isArray(t?.columns) ? t.columns : [];
      for (const c of cols) {
        const tsid = c?.TSid;
        if (!tsid) continue;
        const ugta = c.useInGlobalTemperatureAnalysis;
        // A TSID should only appear in one dataset; still be defensive about
        // duplicates and take the first non-empty value.
        if (!intoMap.has(tsid)) {
          intoMap.set(tsid, { uga: null });
        }
        const rec = intoMap.get(tsid);
        if (rec.uga == null && typeof ugta === 'string' && ugta.trim() !== '') {
          rec.uga = ugta.trim().toUpperCase();
        }
      }
    }
  }
}

// --- Download + process one dataset -----------------------------------------

async function processDataset(ds, idx, total, stats, tsidFlags) {
  const versionUS = versionDotsToUnderscores(ds.datasetVersion);
  const url = `https://lipdverse.org/data/${encodeURIComponent(ds.datasetId)}/${versionUS}/${encodeURIComponent(ds.dataSetName)}.lpd`;
  const outPath = path.join(WORK_DIR, `${ds.datasetId}_${versionUS}.lpd`);

  try {
    const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: AXIOS_TIMEOUT });
    if (resp.status !== 200) throw new Error(`HTTP ${resp.status}`);
    await fsp.writeFile(outPath, Buffer.from(resp.data));
    const meta = await extractMetadata(outPath);
    collectTsidFlags(meta, tsidFlags);
    await fsp.unlink(outPath).catch(() => {});
    stats.ok++;
  } catch (err) {
    const msg = err?.response?.status
      ? `HTTP ${err.response.status}`
      : err?.code || err?.message || String(err);
    stats.failed++;
    stats.failures.push({ datasetId: ds.datasetId, version: ds.datasetVersion, err: msg });
  }
  if ((idx + 1) % 100 === 0) {
    console.log(`  [${idx + 1}/${total}] ok=${stats.ok} failed=${stats.failed} tsidsCollected=${tsidFlags.size}`);
  }
}

// --- Parallel worker pool ----------------------------------------------------

async function runPool(items, worker, concurrency) {
  let cursor = 0;
  const total = items.length;
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= total) return;
      await worker(items[idx], idx, total);
    }
  });
  await Promise.all(workers);
}

// --- MySQL updates -----------------------------------------------------------

async function ensureColumns(conn) {
  const [rows] = await conn.query('SHOW COLUMNS FROM query');
  const existing = new Set(rows.map(r => r.Field));
  const needed = ['paleoData_useInGlobalTemperatureAnalysis'];
  const missing = needed.filter(c => !existing.has(c));
  if (missing.length > 0) {
    const clauses = missing.map(c => `ADD COLUMN \`${c}\` TEXT`).join(', ');
    console.log(`[primaryProxyUpdater] Adding columns: ${missing.join(', ')}`);
    await conn.query('ALTER TABLE query ' + clauses);
  }
}

async function writeUpdates(conn, tsidFlags) {
  const entries = [...tsidFlags.entries()].map(([tsid, v]) => [tsid, v.uga]);
  if (entries.length === 0) {
    console.log('[primaryProxyUpdater] No TSID updates to write');
    return { wrote: 0, matched: 0 };
  }

  await conn.query(`
    CREATE TEMPORARY TABLE proxy_primary_tmp (
      tsid VARCHAR(255) NOT NULL PRIMARY KEY,
      uga  VARCHAR(8)
    ) ENGINE=InnoDB
  `);

  // Bulk insert in batches of BATCH_SIZE.
  let inserted = 0;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    await conn.query('INSERT INTO proxy_primary_tmp (tsid, uga) VALUES ?', [batch]);
    inserted += batch.length;
  }
  console.log(`[primaryProxyUpdater] Staged ${inserted} TSID rows into temp table`);

  const [res] = await conn.query(`
    UPDATE query q
    JOIN proxy_primary_tmp t ON q.paleoData_TSid = t.tsid
       SET q.paleoData_useInGlobalTemperatureAnalysis = t.uga
  `);
  const matched = res.affectedRows || 0;
  console.log(`[primaryProxyUpdater] UPDATE query: ${matched} rows affected`);

  await conn.query('DROP TEMPORARY TABLE proxy_primary_tmp');
  return { wrote: inserted, matched };
}

// --- public entry point ------------------------------------------------------

/**
 * Run the enrichment end-to-end against an existing MySQL connection or by
 * opening a new one. Designed to be called from services/compilationUpdater.js
 * after the nightly CSV reload (which TRUNCATES the table and would otherwise
 * wipe the columns we wrote earlier).
 */
async function updatePrimaryProxyColumns({ conn: externalConn } = {}) {
  const startedAt = Date.now();
  console.log('[primaryProxyUpdater] Starting…');
  await ensureDir(WORK_DIR);

  const conn = externalConn || await mysql.createConnection(dbConfig());
  const ownConn = !externalConn;
  try {
    await ensureColumns(conn);

    console.log('[primaryProxyUpdater] Enumerating distinct datasets from MySQL…');
    const [datasets] = await conn.query(`
      SELECT datasetId, dataSetName, datasetVersion
      FROM query
      WHERE datasetId IS NOT NULL AND datasetId <> ''
        AND dataSetName IS NOT NULL AND dataSetName <> ''
        AND datasetVersion IS NOT NULL AND datasetVersion <> ''
      GROUP BY datasetId, dataSetName, datasetVersion
    `);
    console.log(`[primaryProxyUpdater] ${datasets.length} distinct datasets`);

    const tsidFlags = new Map();
    const stats = { ok: 0, failed: 0, failures: [] };

    await runPool(
      datasets,
      (ds, idx, total) => processDataset(ds, idx, total, stats, tsidFlags),
      CONCURRENCY,
    );

    console.log(`[primaryProxyUpdater] Downloads done: ${stats.ok} ok, ${stats.failed} failed`);
    console.log(`[primaryProxyUpdater] Unique TSIDs collected: ${tsidFlags.size}`);
    if (stats.failures.length > 0 && stats.failures.length <= 25) {
      console.log('[primaryProxyUpdater] Failed datasets:');
      for (const f of stats.failures) console.log(`  ${f.datasetId} v${f.version}: ${f.err}`);
    } else if (stats.failures.length > 25) {
      console.log(`[primaryProxyUpdater] ${stats.failures.length} failures (first 10):`);
      for (const f of stats.failures.slice(0, 10)) console.log(`  ${f.datasetId} v${f.version}: ${f.err}`);
    }

    const writeResult = await writeUpdates(conn, tsidFlags);
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`[primaryProxyUpdater] Done in ${elapsed}s — wrote ${writeResult.wrote} staged, ${writeResult.matched} query rows updated`);
    return {
      datasets: datasets.length,
      downloads_ok: stats.ok,
      downloads_failed: stats.failed,
      tsids_updated: writeResult.matched,
      elapsedSec: Number(elapsed),
    };
  } finally {
    if (ownConn) await conn.end();
  }
}

module.exports = { updatePrimaryProxyColumns };

// CLI entry point — allows running via `node updatePrimaryProxyColumns.js`.
if (require.main === module) {
  updatePrimaryProxyColumns().catch(err => {
    console.error('[primaryProxyUpdater] FATAL:', err);
    process.exit(1);
  });
}
