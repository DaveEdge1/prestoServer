/**
 * Database Setup / Migration Runner
 *
 * Applies every db/migrations/NNN_*.sql in numeric order exactly once, tracking
 * applied files in a `schema_migrations` table. Safe to run repeatedly.
 *
 * First-run backfill: on a database that was set up before this runner existed
 * (the `users` table already exists but `schema_migrations` does not), the
 * schema-creating migrations 001/002 are recorded as already-applied so they
 * are NOT re-run (CREATE TABLE would fail). Later migrations (004, 005, ...)
 * are idempotent ALTERs and run normally.
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'db', 'migrations');

// Migrations that predate this runner (and the schema_migrations table). On a
// database whose schema already exists, they are assumed already applied — the
// live schema reflects them, or a later migration supersedes them — so we never
// replay them. (Notably 004 sets a restrictive recon_type ENUM that conflicts
// with current data and is superseded by 005's VARCHAR conversion.)
const LEGACY_MIGRATIONS = [
  '001_github_integration.sql',
  '002_add_hybrid_auth_support.sql',
  '004_add_lmr_recon_type.sql',
];

function migrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => /^\d+.*\.sql$/.test(f))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

async function setupDatabase() {
  console.log('Connecting to database...');

  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'dave',
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || 'lipdverse',
    multipleStatements: true
  });

  try {
    // Ensure the migration-tracking table exists.
    await connection.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    );

    // Backfill: if the schema already exists, mark the legacy (pre-runner)
    // migrations as applied so we never recreate tables or replay the outdated
    // recon_type ENUM. INSERT IGNORE keeps this idempotent and lets it recover
    // if a prior run recorded only some of them.
    const [users] = await connection.query("SHOW TABLES LIKE 'users'");
    if (users.length > 0) {
      for (const f of LEGACY_MIGRATIONS) {
        await connection.query('INSERT IGNORE INTO schema_migrations (filename) VALUES (?)', [f]);
      }
    }

    const [appliedRows] = await connection.query('SELECT filename FROM schema_migrations');
    const applied = new Set(appliedRows.map(r => r.filename));

    // Apply any migration not yet recorded, in numeric order.
    const files = migrationFiles();
    let ranAny = false;
    for (const file of files) {
      if (applied.has(file)) continue;
      console.log(`Running migration ${file}...`);
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await connection.query(sql);
      await connection.query('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
      console.log(`✅ ${file} applied`);
      ranAny = true;
    }
    if (!ranAny) console.log('✅ No pending migrations — schema up to date.');

    // Verify expected tables / columns.
    console.log('\nVerifying tables...');
    const [allTables] = await connection.query('SHOW TABLES');
    const tableNames = allTables.map(row => Object.values(row)[0]);
    const requiredTables = ['users', 'github_tokens', 'reconstruction_jobs', 'webhook_events'];
    const missingTables = requiredTables.filter(t => !tableNames.includes(t));
    if (missingTables.length > 0) {
      console.log('❌ Missing tables:', missingTables.join(', '));
    } else {
      console.log('✅ All required tables exist:', requiredTables.join(', '));
    }

    const [reconTypeCol] = await connection.query(
      "SHOW COLUMNS FROM reconstruction_jobs LIKE 'recon_type'"
    );
    if (reconTypeCol.length > 0) {
      console.log(`✅ recon_type column type: ${reconTypeCol[0].Type}`);
    }

    console.log('\n✅ Database setup complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

setupDatabase().catch(console.error);
