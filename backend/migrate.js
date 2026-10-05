// backend/migrate.js
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');

async function runMigration() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('FATAL: DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  let dbHost = 'unknown';
  try {
    const parsed = new URL(dbUrl);
    dbHost = parsed.host;
  } catch (e) {
    console.error('FATAL: Invalid DATABASE_URL format.');
    process.exit(1);
  }

  console.log(`[MIGRATION] Connecting to PostgreSQL host: ${dbHost}`);

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    max: 3
  });

  const migrationsDir = path.join(__dirname, 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const client = await pool.connect();
  try {
    for (const file of migrationFiles) {
      const sqlPath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
      console.log(`[MIGRATION] Applying ${file}...`);
      await client.query(sqlContent);
      console.log(`✅ [MIGRATION] Successfully applied ${file}`);
    }
  } catch (err) {
    console.error('❌ [MIGRATION] Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
