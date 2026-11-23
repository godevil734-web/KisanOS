/**
 * Milestone C.1: Production Data Hygiene & CSV Parser Hardening Test Suite
 * 
 * Verifies:
 * 1. Quote balancing detection (isQuoteUnbalanced) handles standard RFC 4180 quotes & escaped ""
 * 2. Streaming multiline CSV ingestion correctly buffers quoted fields across linebreaks
 * 3. Escaped quotes, commas inside quotes, and whitespace sanitization
 * 4. NULL variety/grade preservation (never 'Standard', 'null', or empty string)
 * 5. Deterministic unit conversions (Quintals -> Tonnes, Tonnes 1:1, Kg -> Tonnes, unknown -> NULL)
 * 6. Isolated client transaction with mandatory ROLLBACK ensuring zero database contamination
 * 7. ML Dataset Preparation source exclusion rule (source NOT LIKE 'test%')
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const assert = require('assert');
const { pool } = require('../db');
const {
  isQuoteUnbalanced,
  parseCSVLine,
  cleanNullableString,
  computeArrivalTonnes,
  validateObservationRecord,
  ingestAgmarknetCSV,
  getHistoricalStats,
  fetchMLDatasetObservations
} = require('../services/historicalIngestionService');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log('\n=== KisanOS 2.0: Milestone C.1 CSV Parser Hardening & Production Data Hygiene ===\n');

  // Test 1: Unit tests for isQuoteUnbalanced
  runTest('1. Quote balancing detection handles single-line, escaped, and unclosed quotes', () => {
    assert.strictEqual(isQuoteUnbalanced('Simple text without quotes'), false);
    assert.strictEqual(isQuoteUnbalanced('Text with "balanced quotes" inside'), false);
    assert.strictEqual(isQuoteUnbalanced('Text with unclosed "quote at end'), true);
    assert.strictEqual(isQuoteUnbalanced('"Entire line quoted"'), false);
    assert.strictEqual(isQuoteUnbalanced('"Line with ""escaped quotes"" inside"'), false);
    assert.strictEqual(isQuoteUnbalanced('"Line with ""escaped quotes"" and unclosed'), true);
    assert.strictEqual(isQuoteUnbalanced('Field 1,"Field 2 has, comma",Field 3'), false);
  });

  // Test 2: Unit tests for parseCSVLine
  runTest('2. parseCSVLine handles commas in quotes, escaped quotes, and empty fields', () => {
    const line1 = 'Maharashtra,Nashik,"Lasalgaon APMC",Onion,Red,"Grade ""FAQ""",05/11/2026,1800,2400,2200,450,Quintals';
    const cols1 = parseCSVLine(line1);
    assert.strictEqual(cols1.length, 12);
    assert.strictEqual(cols1[2], 'Lasalgaon APMC');
    assert.strictEqual(cols1[5], 'Grade "FAQ"');

    const line2 = 'A,,C,"D, with comma",';
    const cols2 = parseCSVLine(line2);
    assert.strictEqual(cols2.length, 5);
    assert.strictEqual(cols2[0], 'A');
    assert.strictEqual(cols2[1], '');
    assert.strictEqual(cols2[2], 'C');
    assert.strictEqual(cols2[3], 'D, with comma');
    assert.strictEqual(cols2[4], '');
  });

  // Test 3: Unit tests for computeArrivalTonnes
  runTest('3. computeArrivalTonnes handles known units and leaves unknown units NULL', () => {
    assert.strictEqual(computeArrivalTonnes('450', 'Quintals'), 45.0);
    assert.strictEqual(computeArrivalTonnes('450', 'qtl'), 45.0);
    assert.strictEqual(computeArrivalTonnes('30', 'Tonnes'), 30.0);
    assert.strictEqual(computeArrivalTonnes('30', 'MT'), 30.0);
    assert.strictEqual(computeArrivalTonnes('5000', 'Kg'), 5.0);
    assert.strictEqual(computeArrivalTonnes('5000', 'Kilograms'), 5.0);
    assert.strictEqual(computeArrivalTonnes('100', 'Bags'), null, 'Unknown unit must remain NULL');
    assert.strictEqual(computeArrivalTonnes('100', null), null, 'Missing unit must remain NULL');
    assert.strictEqual(computeArrivalTonnes(null, 'Tonnes'), null, 'Missing arrival quantity must remain NULL');
  });

  // Test 4: NULL variety & grade preservation in validateObservationRecord
  runTest('4. validateObservationRecord preserves NULL variety and grade without substitution', () => {
    const raw = {
      state: 'Uttar Pradesh',
      district: 'Agra',
      market: 'Fatehabad APMC',
      commodity: 'Potato',
      variety: '',
      grade: 'NA',
      arrival_date: '07/11/2026',
      modal_price: '1200'
    };

    const val = validateObservationRecord(raw, 'test:provenance');
    assert.strictEqual(val.valid, true);
    assert.strictEqual(val.normalized.variety, null, 'Empty variety must be null');
    assert.strictEqual(val.normalized.grade, null, 'NA grade must be null');
    assert.notStrictEqual(val.normalized.variety, 'Standard');
    assert.notStrictEqual(val.normalized.grade, 'Standard');
  });

  // Test 5: Multiline CSV streaming ingestion with Transaction Rollback Isolation
  await runAsyncTest('5. Streaming multiline CSV ingestion inside transactional sandbox with clean ROLLBACK', async () => {
    // Isolated transaction client
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // CSV with:
      // 1. Multiline market name split across 2 lines
      // 2. Multiline variety with escaped quotes split across 2 lines
      // 3. Various arrival units and NULL fields
      const multilineCSV = `State,District,Market,Commodity,Variety,Grade,Arrival_Date,Min_Price,Max_Price,Modal_Price,Arrivals,Unit
Maharashtra,Nashik,"Lasalgaon
APMC Yard",Onion,Red,FAQ,15/11/2099,1800,2400,2200,450,Quintals
Karnataka,Kolar,Kolar APMC,Tomato,"Hybrid
""F1 Special""",,15/11/2099,1200,1600,1450,30,Tonnes
Punjab,Ludhiana,Ludhiana APMC,Wheat,PBW 550,FAQ,15/11/2099,2275,2350,2300,5000,Kg
Madhya Pradesh,Indore,Indore APMC,Soyabean,Yellow,,15/11/2099,4400,4750,4600,200,Bags`;

      const stats = await ingestAgmarknetCSV(multilineCSV, {
        defaultSource: 'test:multiline-csv',
        clientOrPool: client
      });

      console.log(`    [Transactional CSV Stats] Rows: ${stats.totalRows}, Imported: ${stats.imported}, Duplicates: ${stats.duplicates}, Rejected: ${stats.rejected}`);

      assert.strictEqual(stats.totalRows, 4, 'Must parse exactly 4 logical records from multiline input');
      assert.strictEqual(stats.imported, 4, 'Must import all 4 valid records inside transaction');
      assert.strictEqual(stats.rejected, 0, 'Zero corrupt rows');

      // Verify multiline market name inside transaction
      const m1 = await client.query(`
        SELECT market, commodity, variety, grade, modal_price_per_quintal, arrival_quantity_tonnes, raw_arrivals_unit
        FROM mandi_historical_observations
        WHERE observation_date = '2099-11-15' AND commodity = 'Onion';
      `);
      assert.strictEqual(m1.rows.length, 1);
      assert.strictEqual(m1.rows[0].market, 'Lasalgaon APMC Yard', 'Multiline market name whitespace normalized');
      assert.strictEqual(Number(m1.rows[0].arrival_quantity_tonnes), 45.0, '450 Quintals -> 45.0 Tonnes');

      // Verify multiline variety with escaped quotes
      const m2 = await client.query(`
        SELECT variety, grade, arrival_quantity_tonnes
        FROM mandi_historical_observations
        WHERE observation_date = '2099-11-15' AND commodity = 'Tomato';
      `);
      assert.strictEqual(m2.rows.length, 1);
      assert.strictEqual(m2.rows[0].variety, 'Hybrid "F1 Special"', 'Multiline variety with quotes parsed correctly');
      assert.strictEqual(m2.rows[0].grade, null, 'Grade remains NULL');
      assert.strictEqual(Number(m2.rows[0].arrival_quantity_tonnes), 30.0, '30 Tonnes -> 30.0 Tonnes');

      // Verify Kg conversion
      const m3 = await client.query(`
        SELECT arrival_quantity_tonnes, raw_arrivals_unit
        FROM mandi_historical_observations
        WHERE observation_date = '2099-11-15' AND commodity = 'Wheat';
      `);
      assert.strictEqual(m3.rows.length, 1);
      assert.strictEqual(Number(m3.rows[0].arrival_quantity_tonnes), 5.0, '5000 Kg -> 5.0 Tonnes');

      // Verify unknown Bags unit remains NULL
      const m4 = await client.query(`
        SELECT arrival_quantity_tonnes, raw_arrivals_unit, raw_arrivals_value
        FROM mandi_historical_observations
        WHERE observation_date = '2099-11-15' AND commodity = 'Soyabean';
      `);
      assert.strictEqual(m4.rows.length, 1);
      assert.strictEqual(m4.rows[0].arrival_quantity_tonnes, null, 'Unknown unit Bags must be NULL');
      assert.strictEqual(m4.rows[0].raw_arrivals_unit, 'Bags', 'Raw unit preserved');
      assert.strictEqual(m4.rows[0].raw_arrivals_value, '200', 'Raw value preserved');

      // Test Rerun idempotency inside transaction
      const rerunStats = await ingestAgmarknetCSV(multilineCSV, {
        defaultSource: 'test:multiline-csv',
        clientOrPool: client
      });
      assert.strictEqual(rerunStats.imported, 0, 'Rerun inside transaction must import 0 new rows');
      assert.strictEqual(rerunStats.duplicates, 4, 'All 4 rows must be detected as duplicates');

    } finally {
      // Mandatory rollback to keep production database 100% clean
      await client.query('ROLLBACK');
      client.release();
    }

    // Verify after ROLLBACK: zero records persisted in production DB
    const leakCheck = await pool.query(`
      SELECT COUNT(*)::int as count 
      FROM mandi_historical_observations 
      WHERE observation_date = '2099-11-15';
    `);
    assert.strictEqual(leakCheck.rows[0].count, 0, 'Rollback guaranteed: 0 records leaked to database');
  });

  // Test 6: ML Dataset Preparation Pipeline Source Exclusion Rule (Case-Insensitive)
  await runAsyncTest('6. ML Dataset Preparation strictly excludes test% source fixtures case-insensitively by default', async () => {
    // 1. Call fetchMLDatasetObservations with excludeTest = true (default)
    const cleanDataset = await fetchMLDatasetObservations({ excludeTest: true });
    const testLeakCount = cleanDataset.filter(r => r.source && r.source.toLowerCase().startsWith('test')).length;
    assert.strictEqual(testLeakCount, 0, 'Zero test records may appear in ML training dataset');

    // 2. Call with excludeTest = false and confirm the existing test records are found
    const allRecords = await fetchMLDatasetObservations({ excludeTest: false, limit: 10000 });
    const testRecords = allRecords.filter(r => r.source && r.source.toLowerCase().startsWith('test'));
    assert.ok(testRecords.length >= 4, 'Test fixtures are found when explicitly requested for hygiene verification');

    // 3. getHistoricalStats excludes test% fixtures
    const statsClean = await getHistoricalStats({ excludeTest: true });
    const statsAll = await getHistoricalStats({ excludeTest: false });
    assert.strictEqual(statsAll.totalRecords - statsClean.totalRecords, testRecords.length, 'Discrepancy exactly equals test fixture count');

    const cleanDateList = statsClean.observationDates.map(d => d.observation_date);
    assert.ok(!cleanDateList.includes('2026-11-05'), 'Synthetic test date 2026-11-05 must be absent from clean statistics');

    // 4. Case-insensitivity test inside an isolated transaction
    const caseClient = await pool.connect();
    try {
      await caseClient.query('BEGIN');
      await caseClient.query(`
        INSERT INTO mandi_historical_observations (
          id, state, district, market, commodity, variety, grade, observation_date,
          modal_price_per_quintal, modal_price_per_kg, source, raw_payload
        ) VALUES 
          ('test-upper-id', 'Test State', 'Test District', 'Test Market', 'Wheat', NULL, NULL, '2099-01-01', 2000, 20.0, 'TEST:UPPERCASE', '{}'::jsonb),
          ('test-mixed-id', 'Test State', 'Test District', 'Test Market 2', 'Rice', NULL, NULL, '2099-01-01', 3000, 30.0, 'Test:MixedCase', '{}'::jsonb);
      `);

      const cleanWithCase = await fetchMLDatasetObservations({ excludeTest: true, clientOrPool: caseClient });
      const upperLeak = cleanWithCase.filter(r => r.id === 'test-upper-id' || r.id === 'test-mixed-id');
      assert.strictEqual(upperLeak.length, 0, 'Uppercase and MixedCase test sources must be strictly excluded by ILIKE');

      const allWithCase = await fetchMLDatasetObservations({ excludeTest: false, clientOrPool: caseClient });
      const upperFound = allWithCase.filter(r => r.id === 'test-upper-id' || r.id === 'test-mixed-id');
      assert.strictEqual(upperFound.length, 2, 'Uppercase and MixedCase test sources are retrieved when excludeTest = false');
    } finally {
      await caseClient.query('ROLLBACK');
      caseClient.release();
    }
  });

  console.log(`\nMilestone C.1 Scoreboard: ${passedTests}/${totalTests} tests passed.\n`);
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Test Suite Failed:', err);
    await pool.end();
    process.exit(1);
  });

