/**
 * userRecons cleanup scheduler
 *
 * Retention policy:
 *   Files > 1 MB  →  deleted after 7 days  (large outputs: pkl, zip, etc.)
 *   Files ≤ 1 MB  →  deleted after 30 days (JSON metadata, progress, configs)
 *
 * After all files in a session directory have been removed the empty directory
 * is also deleted.
 *
 * Runs once ~30 s after server startup, then every 24 hours.
 */

const fs     = require('fs');
const path   = require('path');
const config = require('../config');

const LARGE_THRESHOLD_BYTES  = 1 * 1024 * 1024;          // 1 MB
const LARGE_MAX_AGE_MS       = 7  * 24 * 60 * 60 * 1000; // 7 days
const SMALL_MAX_AGE_MS       = 30 * 24 * 60 * 60 * 1000; // 30 days
const RUN_INTERVAL_MS        = 24 * 60 * 60 * 1000;       // every 24 h
const STARTUP_DELAY_MS       = 30 * 1000;                 // 30 s after boot

function runCleanup() {
  const baseDir = config.paths.userRecons;
  if (!fs.existsSync(baseDir)) return;

  const now = Date.now();
  let deletedFiles = 0;
  let deletedDirs  = 0;

  let sessionDirs;
  try {
    sessionDirs = fs.readdirSync(baseDir);
  } catch (err) {
    console.error('[cleanup] Cannot read userRecons dir:', err.message);
    return;
  }

  for (const dirName of sessionDirs) {
    const dirPath = path.join(baseDir, dirName);
    let dirStat;
    try { dirStat = fs.statSync(dirPath); } catch { continue; }
    if (!dirStat.isDirectory()) continue;

    let files;
    try { files = fs.readdirSync(dirPath); } catch { continue; }

    for (const fileName of files) {
      const filePath = path.join(dirPath, fileName);
      let fileStat;
      try { fileStat = fs.statSync(filePath); } catch { continue; }
      if (!fileStat.isFile()) continue;

      const ageMs  = now - fileStat.mtimeMs;
      const maxAge = fileStat.size > LARGE_THRESHOLD_BYTES
        ? LARGE_MAX_AGE_MS
        : SMALL_MAX_AGE_MS;

      if (ageMs > maxAge) {
        try {
          fs.unlinkSync(filePath);
          deletedFiles++;
        } catch (err) {
          console.error(`[cleanup] Could not delete ${filePath}:`, err.message);
        }
      }
    }

    // Remove the session directory if it is now empty
    try {
      if (fs.readdirSync(dirPath).length === 0) {
        fs.rmdirSync(dirPath);
        deletedDirs++;
      }
    } catch { /* ignore race conditions */ }
  }

  if (deletedFiles > 0 || deletedDirs > 0) {
    console.log(
      `[cleanup] Removed ${deletedFiles} file(s) and ${deletedDirs} empty session dir(s) from userRecons`
    );
  }
}

function startCleanupScheduler() {
  setTimeout(() => {
    runCleanup();
    setInterval(runCleanup, RUN_INTERVAL_MS);
  }, STARTUP_DELAY_MS);
  console.log('[cleanup] Scheduler registered (first run in 30 s, then every 24 h)');
}

module.exports = { startCleanupScheduler };
