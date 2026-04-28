/**
 * Nightly lipdverse sync + compilation dropdown generator
 *
 * Every night at 02:00 (server local time):
 *   1. Download https://lipdverse.org/lipdverse/lipdverseQuery.zip
 *   2. If MD5 changed, TRUNCATE+reload the MySQL `query` table from the CSV
 *   3. Regenerate query/public/compilationMetadata.js from DISTINCT
 *      paleoData_mostRecentCompilations values in the `query` table
 *
 * Because the dropdown is derived from the DB, the UI can never offer a
 * compilation/version that returns zero rows. Both the filter selector
 * (`compilationIn`) and the archived selector (`archivedCompilationIn`
 * / `archivedCompilationVersionIn`) read from the same compilationJson,
 * so both update together.
 */

const fs       = require('fs');
const fsp      = require('fs').promises;
const path     = require('path');
const crypto   = require('crypto');
const https    = require('https');
const { execFile } = require('child_process');
const mysql    = require('mysql2/promise');
const { updatePrimaryProxyColumns } = require('../scripts/updatePrimaryProxyColumns');

const OUTPUT_FILE = path.join(__dirname, '..', 'query', 'public', 'compilationMetadata.js');
const WORK_DIR    = '/tmp/lipdverse_update';
const ZIP_FILE    = path.join(WORK_DIR, 'lipdverseQuery.zip');
const CSV_FILE    = path.join(WORK_DIR, 'lipdverseQuery.csv');
const MD5_FILE    = path.join(__dirname, '..', 'query', 'lipdverseQuery.md5');
const ZIP_URL     = 'https://lipdverse.org/lipdverse/lipdverseQuery.zip';

const STARTUP_DELAY_MS = 60 * 1000;
const NIGHTLY_HOUR     = 2; // 02:00 local time

function dbConfig(extra = {}) {
  return {
    host:     process.env.MYSQL_HOST     || 'localhost',
    user:     process.env.MYSQL_USER     || 'dave',
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || 'lipdverse',
    ...extra,
  };
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

function unzip(zipPath, outDir) {
  return new Promise((resolve, reject) => {
    execFile('unzip', ['-o', zipPath, '-d', outDir], (err, stdout, stderr) => {
      if (err) reject(new Error(`unzip failed: ${stderr || err.message}`));
      else resolve();
    });
  });
}

async function md5(file) {
  const buf = await fsp.readFile(file);
  return crypto.createHash('md5').update(buf).digest('hex');
}

async function readStoredMd5() {
  try { return (await fsp.readFile(MD5_FILE, 'utf8')).trim(); }
  catch { return null; }
}

async function reloadTableFromCsv(csvPath) {
  const conn = await mysql.createConnection(dbConfig({
    flags: ['+LOCAL_FILES'],
    infileStreamFactory: () => fs.createReadStream(csvPath),
  }));
  try {
    const [[{ old_count }]] = await conn.query('SELECT COUNT(*) AS old_count FROM query');
    console.log(`[lipdverseSync] DB has ${old_count} rows before reload`);

    // Read CSV header so we map CSV columns → table columns by name.
    // The table has a leading `row_names` column the CSV lacks; listing
    // columns explicitly (CSV header order) keeps data aligned.
    const firstLine = (await fsp.readFile(csvPath, { encoding: 'utf8', flag: 'r' }))
      .split(/\r?\n/, 1)[0];
    const csvCols = firstLine.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
    const colList = csvCols.map(c => '`' + c.replace(/`/g, '') + '`').join(', ');

    const [existingColRows] = await conn.query('SHOW COLUMNS FROM query');
    const existingCols = new Set(existingColRows.map(r => r.Field));
    const missingCols = csvCols.filter(c => !existingCols.has(c));
    if (missingCols.length > 0) {
      const clauses = missingCols
        .map(c => 'ADD COLUMN `' + c.replace(/`/g, '') + '` TEXT')
        .join(', ');
      console.log(`[lipdverseSync] Adding columns to query table: ${missingCols.join(', ')}`);
      await conn.query('ALTER TABLE query ' + clauses);
    }

    await conn.query('TRUNCATE TABLE query');
    await conn.query(
      `LOAD DATA LOCAL INFILE ? INTO TABLE query
       FIELDS TERMINATED BY ',' ENCLOSED BY '"'
       LINES TERMINATED BY '\\n' IGNORE 1 ROWS (${colList})`,
      [csvPath]
    );
    const [[{ new_count }]] = await conn.query('SELECT COUNT(*) AS new_count FROM query');
    console.log(`[lipdverseSync] Reload complete: ${old_count} → ${new_count} (${new_count - old_count >= 0 ? '+' : ''}${new_count - old_count})`);
    return new_count;
  } finally {
    await conn.end();
  }
}

function parseCompilationString(raw) {
  // A single DB cell may contain multiple compilations joined by ", "
  // (e.g. "HoloceneAbruptChange-0_11_0, HoloceneHydroclimate-0_9_1, SISAL-LiPD-2_1_1").
  // Split on commas first, then parse each piece on the LAST "-" so names
  // containing dashes (e.g. "SISAL-LiPD") survive intact.
  const out = [];
  for (const piece of raw.split(',')) {
    const s = piece.trim();
    if (!s) continue;
    const idx = s.lastIndexOf('-');
    if (idx < 1 || idx === s.length - 1) continue;
    const name    = s.slice(0, idx);
    const version = s.slice(idx + 1);
    if (!/^\d+(_\d+)*$/.test(version)) continue;
    out.push({ name, version });
  }
  return out;
}

function compareVersionsDesc(a, b) {
  const pa = a.split('_').map(Number);
  const pb = b.split('_').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pb[i] || 0) - (pa[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function buildCompilationMetadataFromDb() {
  const conn = await mysql.createConnection(dbConfig());
  try {
    const [rows] = await conn.query(
      `SELECT paleoData_mostRecentCompilations AS c, COUNT(*) AS n
         FROM query
        WHERE paleoData_mostRecentCompilations IS NOT NULL
          AND paleoData_mostRecentCompilations != ''
        GROUP BY paleoData_mostRecentCompilations`
    );

    const byName = {};
    for (const { c, n } of rows) {
      if (!n) continue;
      for (const parsed of parseCompilationString(c)) {
        (byName[parsed.name] ||= new Set()).add(parsed.version);
      }
    }

    const out = {};
    for (const name of Object.keys(byName).sort()) {
      const versions = Array.from(byName[name]).sort(compareVersionsDesc);
      out[name] = {
        compilationName: name,
        versions: versions.length === 1 ? versions[0] : versions,
      };
    }
    return out;
  } finally {
    await conn.end();
  }
}

async function writeCompilationMetadata(compilationJson) {
  const count = Object.keys(compilationJson).length;
  if (count === 0) {
    console.warn('[lipdverseSync] 0 compilations derived from DB — skipping file write');
    return;
  }
  const content = 'var compilationJson = ' + JSON.stringify(compilationJson, null, 2) + '\n';
  await fsp.writeFile(OUTPUT_FILE, content, 'utf8');
  console.log(`[lipdverseSync] Wrote ${count} compilations to ${OUTPUT_FILE}`);
}

async function runSync() {
  console.log('[lipdverseSync] Starting update...');
  try {
    await fsp.mkdir(WORK_DIR, { recursive: true });
    await download(ZIP_URL, ZIP_FILE);
    await unzip(ZIP_FILE, WORK_DIR);

    if (!fs.existsSync(CSV_FILE)) {
      throw new Error(`CSV not found at ${CSV_FILE} after unzip`);
    }

    const newMd5 = await md5(CSV_FILE);
    const oldMd5 = await readStoredMd5();
    console.log(`[lipdverseSync] MD5 old=${oldMd5 || 'none'} new=${newMd5}`);

    let reloaded = false;
    if (newMd5 !== oldMd5) {
      await reloadTableFromCsv(CSV_FILE);
      await fsp.writeFile(MD5_FILE, newMd5, 'utf8');
      reloaded = true;
    } else {
      console.log('[lipdverseSync] CSV unchanged, skipping DB reload');
    }

    // Always regenerate metadata from DB (covers startup after manual DB edits)
    const compilationJson = await buildCompilationMetadataFromDb();
    await writeCompilationMetadata(compilationJson);

    // Primary-proxy enrichment. The reload TRUNCATEs the `query` table, wiping
    // the enrichment column (paleoData_useInGlobalTemperatureAnalysis), so we
    // rerun the updater whenever we reload. Skip on unchanged CSV to save ~15
    // min of per-dataset .lpd fetches.
    if (reloaded) {
      try {
        await updatePrimaryProxyColumns();
      } catch (err) {
        console.error('[lipdverseSync] Primary-proxy enrichment failed:', err.message);
      }
    } else {
      console.log('[lipdverseSync] CSV unchanged — skipping primary-proxy enrichment');
    }

    console.log('[lipdverseSync] Done.');
  } catch (err) {
    console.error('[lipdverseSync] Failed:', err.message);
  }
}

function msUntilNext(hour) {
  const now  = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next - now;
}

function scheduleNightly() {
  const delay = msUntilNext(NIGHTLY_HOUR);
  const hours = (delay / 3600000).toFixed(2);
  console.log(`[lipdverseSync] Next nightly run in ${hours} h`);
  setTimeout(async () => {
    await runSync();
    scheduleNightly();
  }, delay);
}

function startCompilationUpdater() {
  setTimeout(runSync, STARTUP_DELAY_MS);
  scheduleNightly();
  console.log(`[lipdverseSync] Scheduler registered (first run in ${STARTUP_DELAY_MS / 1000}s; nightly at ${NIGHTLY_HOUR}:00)`);
}

module.exports = { startCompilationUpdater, runSync };
