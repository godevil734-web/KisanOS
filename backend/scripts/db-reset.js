// backend/scripts/db-reset.js
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { Pool } = require('pg');
const { seedDatabase } = require('../seed');

async function askConfirmation(host) {
  const isForce = process.argv.includes('--force') || process.argv.includes('-y') || !process.stdin.isTTY;
  if (isForce) return true;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(
      `⚠️  WARNING: You are about to RESET your DEV database at ${host}.\nPress Ctrl+C to abort or Enter to continue: `,
      () => {
        rl.close();
        resolve(true);
      }
    );
  });
}

async function resetDatabase() {
  const dbEnv = process.env.DB_ENV;
  if (dbEnv !== 'dev') {
    console.error(`FATAL: Database reset is prohibited unless DB_ENV=dev. Current: "${dbEnv || 'undefined'}". Aborting.`);
    process.exit(1);
  }

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

  console.log(`\n======================================================`);
  console.log(`[DB RESET] Target Database Host: ${dbHost}`);
  console.log(`======================================================\n`);

  await askConfirmation(dbHost);

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    max: 3
  });

  const client = await pool.connect();

  try {
    console.log('[DB RESET] Dropping all existing public tables...');
    await client.query(`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);
    console.log('✅ [DB RESET] Dropped all tables.');

    console.log('[DB RESET] Recreating schema from migrations/*.sql in order...');
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      await client.query(sql);
      console.log(`✅ [DB RESET] Applied migration: ${file}`);
    }

    // Count created tables
    const tableRes = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    const tablesCreated = tableRes.rows.length;

    client.release();
    await pool.end();

    console.log('[DB RESET] Repopulating database with seed.js...');
    await seedDatabase();

    // Query total rows count across all public tables
    const verifyPool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      max: 2
    });

    let totalRows = 0;
    for (const row of tableRes.rows) {
      const countRes = await verifyPool.query(`SELECT count(*) FROM "${row.table_name}"`);
      totalRows += parseInt(countRes.rows[0].count, 10);
    }
    await verifyPool.end();

    console.log(`\n======================================================`);
    console.log(`Database reset complete. ${tablesCreated} tables created, ${totalRows} rows seeded.`);
    console.log(`======================================================\n`);
    process.exit(0);
  } catch (err) {
    console.error('❌ [DB RESET] Reset failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  resetDatabase();
}

module.exports = { resetDatabase };
