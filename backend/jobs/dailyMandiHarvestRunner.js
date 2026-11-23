/**
 * KisanOS Daily Mandi Harvest External Entrypoint (Dormant / Inactive)
 * 
 * Intended strictly for future execution by an external scheduler (GitHub Actions /
 * Cloud Scheduler / Dedicated Worker) or authorized manual operator command.
 * 
 * NEVER activates automatically on module import.
 * Strictly gated by MANDI_DAILY_HARVEST_ENABLED (defaults to false).
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const {
  isDailyHarvestEnabled,
  runScheduledHarvestCycle,
  PostgresAdvisoryLockProvider
} = require('../services/dailyMandiSchedulerService');
const { PostgresAuditTelemetryStore } = require('../services/auditTelemetryStore');

async function executeCliRun() {
  if (!isDailyHarvestEnabled(process.env)) {
    console.log(JSON.stringify({
      executed: false,
      status: 'DISABLED_BY_FEATURE_FLAG',
      reason: 'MANDI_DAILY_HARVEST_ENABLED is not enabled'
    }));
    return { executed: false, status: 'DISABLED_BY_FEATURE_FLAG' };
  }

  // Only import DB pool when feature flag is explicitly active
  const { pool } = require('../db');
  const lockProvider = new PostgresAdvisoryLockProvider(pool);
  const auditStore = new PostgresAuditTelemetryStore(pool, {
    actor: 'daily-mandi-harvest-cli'
  });

  try {
    const result = await runScheduledHarvestCycle({
      dbClientOrPool: pool,
      lockProvider,
      auditStore
    });
    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  executeCliRun()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[HARVEST RUNNER ERROR]', err);
      process.exit(1);
    });
}

module.exports = { executeCliRun };

