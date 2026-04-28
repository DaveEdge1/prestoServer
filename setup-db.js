/**
 * Database Setup Script
 * Checks if tables exist and runs migrations if needed
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

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
    // Check if tables exist
    console.log('\nChecking existing tables...');
    const [tables] = await connection.query("SHOW TABLES LIKE '%users%'");

    if (tables.length === 0) {
      console.log('❌ Tables not found. Running migrations...\n');

      // Run migration 001
      console.log('Running migration 001_github_integration.sql...');
      const migration001 = fs.readFileSync(
        path.join(__dirname, 'db', 'migrations', '001_github_integration.sql'),
        'utf8'
      );
      await connection.query(migration001);
      console.log('✅ Migration 001 completed');

      // Run migration 002
      console.log('Running migration 002_add_hybrid_auth_support.sql...');
      const migration002 = fs.readFileSync(
        path.join(__dirname, 'db', 'migrations', '002_add_hybrid_auth_support.sql'),
        'utf8'
      );
      await connection.query(migration002);
      console.log('✅ Migration 002 completed');

    } else {
      console.log('✅ Tables already exist');
    }

    // Verify all tables
    console.log('\nVerifying tables...');
    const [allTables] = await connection.query("SHOW TABLES");
    const tableNames = allTables.map(row => Object.values(row)[0]);

    const requiredTables = ['users', 'github_tokens', 'reconstruction_jobs', 'webhook_events'];
    const missingTables = requiredTables.filter(t => !tableNames.includes(t));

    if (missingTables.length > 0) {
      console.log('❌ Missing tables:', missingTables.join(', '));
    } else {
      console.log('✅ All required tables exist:', requiredTables.join(', '));
    }

    // Check reconstruction_jobs columns
    console.log('\nChecking reconstruction_jobs columns...');
    const [columns] = await connection.query("SHOW COLUMNS FROM reconstruction_jobs");
    const columnNames = columns.map(c => c.Field);

    const requiredColumns = ['auth_type', 'is_anonymous', 'github_org'];
    const hasHybridColumns = requiredColumns.every(col => columnNames.includes(col));

    if (hasHybridColumns) {
      console.log('✅ Hybrid auth columns exist:', requiredColumns.join(', '));
    } else {
      console.log('❌ Missing hybrid auth columns');
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
