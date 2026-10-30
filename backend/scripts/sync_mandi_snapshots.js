/**
 * KisanConnect Real Government Mandi Prices Sync Script
 * 
 * Fetches real, official APMC prices from data.gov.in for all major Indian states
 * and populates / refreshes authentic snapshots in the Supabase PostgreSQL database.
 * 
 * Run manually: npm run sync:mandi
 * Or scheduled via cron / GitHub Actions / deployment hooks.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { getMandiPrices } = require('../services/mandiService');
const { pool } = require('../db');

const MAJOR_STATES = [
  'Uttar Pradesh',
  'Punjab',
  'Haryana',
  'Rajasthan',
  'Madhya Pradesh',
  'Maharashtra',
  'Gujarat',
  'Bihar',
  'West Bengal',
  'Karnataka',
  'Tamil Nadu',
  'Andhra Pradesh',
  'Telangana',
  'Odisha',
  'Assam',
  'Uttarakhand',
  'Himachal Pradesh'
];

async function syncMandiSnapshots() {
  console.log('===============================================================');
  console.log('🌾 KISANCONNECT GOVERNMENT MANDI PRICES SYNCHRONIZATION');
  console.log('   Timestamp:', new Date().toISOString());
  console.log('===============================================================\n');

  let totalSyncedStates = 0;
  let totalSyncedRecords = 0;
  const stateSummary = [];

  for (const stateName of MAJOR_STATES) {
    try {
      console.log(`📡 Fetching live APMC records for [${stateName}]...`);
      const res = await getMandiPrices({
        state: stateName,
        district: 'all',
        commodity: 'all',
        refresh: true,
        limit: 300
      });

      if (res && res.records && res.records.length > 0) {
        totalSyncedStates++;
        totalSyncedRecords += res.records.length;
        stateSummary.push({
          state: stateName,
          records: res.records.length,
          commodities: res.distinctCommoditiesCount || res.commoditySummaries.length,
          reportDate: res.reportDate,
          source: res.source
        });
        console.log(`   ✅ Synced ${res.records.length} records (${res.reportDate}) across ${res.commoditySummaries.length} commodities.`);

        // Also identify active districts and update district-level snapshots
        const districtGroups = {};
        for (const rec of res.records) {
          const dName = rec.district;
          if (!dName) continue;
          if (!districtGroups[dName]) districtGroups[dName] = [];
          districtGroups[dName].push(rec);
        }

        for (const [distName, dRecords] of Object.entries(districtGroups)) {
          if (dRecords.length >= 2) {
            const distCacheKey = `${stateName.toLowerCase()}:${distName.toLowerCase()}:all:latest`;
            const distPayload = {
              success: true,
              source: res.source,
              reportDate: res.reportDate,
              state: stateName,
              district: distName,
              commodity: 'All Commodities',
              totalRecords: dRecords.length,
              distinctCommoditiesCount: new Set(dRecords.map(r => r.commodity)).size,
              commoditySummaries: [],
              records: dRecords,
              lastUpdated: new Date().toISOString()
            };

            await pool.query(`
              INSERT INTO mandi_price_snapshots (cache_key, state, district, commodity, source, report_date, total_records, data, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
              ON CONFLICT (cache_key) DO UPDATE
              SET source = EXCLUDED.source,
                  report_date = EXCLUDED.report_date,
                  total_records = EXCLUDED.total_records,
                  data = EXCLUDED.data,
                  updated_at = NOW()
            `, [
              distCacheKey,
              stateName,
              distName,
              'all',
              res.source,
              res.reportDate,
              dRecords.length,
              JSON.stringify(distPayload)
            ]).catch(() => {});
          }
        }
      } else {
        console.log(`   ⚠️ No live records returned for ${stateName} today.`);
      }

      // Polite rate-limit gap between state API queries (300ms)
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.warn(`   ❌ Failed to sync ${stateName}: ${err.message}`);
    }
  }

  console.log('\n===============================================================');
  console.log('🎉 MANDI SYNC COMPLETED:');
  console.log(`   States Synced: ${totalSyncedStates}/${MAJOR_STATES.length}`);
  console.log(`   Total Genuine Records Synced: ${totalSyncedRecords}`);
  console.log('===============================================================');
  console.table(stateSummary);

  return { totalSyncedStates, totalSyncedRecords, stateSummary };
}

if (require.main === module) {
  syncMandiSnapshots()
    .then(() => {
      console.log('Synchronization finished successfully.');
      process.exit(0);
    })
    .catch(err => {
      console.error('Synchronization failed:', err);
      process.exit(1);
    });
}

module.exports = { syncMandiSnapshots };
