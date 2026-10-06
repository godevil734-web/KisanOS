// backend/db.js
// Direct PostgreSQL Relational Database Layer for KisanConnect
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

function hashPassword(pass) {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(pass, salt);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: Number(process.env.PG_MAX_POOL) || (process.env.NODE_ENV === 'production' || process.env.VERCEL ? 3 : 5),
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 15000,
  keepAlive: true
});

pool.on('error', (err) => {
  console.warn('[PG POOL] Warning: Idle database client error (handled):', err.message);
});

const originalQuery = pool.query.bind(pool);
pool.query = async function (sql, params, callback) {
  if (typeof params === 'function') {
    callback = params;
    params = undefined;
  }
  try {
    return await originalQuery(sql, params);
  } catch (err) {
    if (err.message && (err.message.includes('timeout') || err.message.includes('terminated') || err.message.includes('closed') || err.message.includes('ECONNRESET'))) {
      console.warn('[PG POOL] Retrying query after transient connection issue:', err.message);
      return await originalQuery(sql, params);
    }
    throw err;
  }
};

const safeQuery = pool.query;

// Helper for snake_case -> camelCase conversion
function snakeToCamel(s) {
  return s.replace(/_([a-z0-9])/g, (_, g) => g.toUpperCase());
}

// Helper for camelCase -> snake_case conversion
function camelToSnake(s) {
  return s.replace(/[A-Z]/g, letter => '_' + letter.toLowerCase());
}

// Map PostgreSQL row to frontend/application camelCase object with correct types
function mapRow(row) {
  if (!row) return null;
  const res = {};
  for (const [k, v] of Object.entries(row)) {
    const camel = snakeToCamel(k);
    if (
      v !== null &&
      typeof v === 'string' &&
      !isNaN(v) &&
      v.trim() !== '' &&
      (k.includes('price') ||
       k.includes('tons') ||
       k.includes('rating') ||
       k.includes('cost') ||
       k.includes('amount') ||
       k.includes('capacity') ||
       k.includes('percent') ||
       k.includes('margin') ||
       k.includes('orders') ||
       k.includes('count') ||
       k.includes('fee') ||
       k.includes('rate') ||
       k.includes('limit'))
    ) {
      res[camel] = Number(v);
    } else {
      res[camel] = v;
    }
  }
  return res;
}

const TABLE_MAP = {
  users: 'users',
  farmerListings: 'farmer_listings',
  buyerRequirements: 'buyer_requirements',
  aggregationBatches: 'aggregation_batches',
  coldStorages: 'cold_storages',
  storageBookings: 'storage_bookings',
  transporters: 'transporters',
  transporterBookings: 'transporter_bookings',
  subscriptionPlans: 'subscription_plans',
  offers: 'offers',
  orders: 'orders',
  marketPrices: 'market_prices',
  regionalSupplyForecasts: 'regional_supply_forecasts',
  notifications: 'notifications',
  reviews: 'reviews',
  crops: 'crops',
  farmActivities: 'farm_activities',
  activities: 'farm_activities',
  procurementPlans: 'procurement_plans'
};

let tableColumnsCache = null;

async function getTableColumns() {
  if (tableColumnsCache) return tableColumnsCache;
  const res = await pool.query(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
  `);
  const map = {};
  for (const row of res.rows) {
    if (!map[row.table_name]) map[row.table_name] = new Set();
    map[row.table_name].add(row.column_name);
  }
  tableColumnsCache = map;
  return map;
}

class PostgresDatabaseAdapter {
  async find(collection, filterFnOrWhere) {
    const table = TABLE_MAP[collection] || camelToSnake(collection);
    if (typeof filterFnOrWhere === 'object' && filterFnOrWhere !== null) {
      const keys = Object.keys(filterFnOrWhere);
      if (keys.length === 0) {
        const res = await pool.query(`SELECT * FROM ${table} ORDER BY created_at DESC`);
        return res.rows.map(mapRow);
      }
      const whereClauses = keys.map((k, i) => `${camelToSnake(k)} = $${i + 1}`).join(' AND ');
      const values = keys.map(k => filterFnOrWhere[k]);
      const res = await pool.query(`SELECT * FROM ${table} WHERE ${whereClauses} ORDER BY created_at DESC`, values);
      return res.rows.map(mapRow);
    }
    const res = await pool.query(`SELECT * FROM ${table}`);
    const mapped = res.rows.map(mapRow);
    if (typeof filterFnOrWhere === 'function') {
      return mapped.filter(filterFnOrWhere);
    }
    return mapped;
  }

  async findById(collection, id) {
    const table = TABLE_MAP[collection] || camelToSnake(collection);
    const res = await pool.query(`SELECT * FROM ${table} WHERE id = $1 LIMIT 1`, [id]);
    return res.rows.length > 0 ? mapRow(res.rows[0]) : null;
  }

  async findOne(collection, filterFnOrWhere) {
    const table = TABLE_MAP[collection] || camelToSnake(collection);
    if (typeof filterFnOrWhere === 'object' && filterFnOrWhere !== null) {
      const keys = Object.keys(filterFnOrWhere);
      const whereClauses = keys.map((k, i) => `${camelToSnake(k)} = $${i + 1}`).join(' AND ');
      const values = keys.map(k => filterFnOrWhere[k]);
      const res = await pool.query(`SELECT * FROM ${table} WHERE ${whereClauses} LIMIT 1`, values);
      return res.rows.length > 0 ? mapRow(res.rows[0]) : null;
    }
    const res = await pool.query(`SELECT * FROM ${table}`);
    const mapped = res.rows.map(mapRow);
    return mapped.find(filterFnOrWhere) || null;
  }

  async insert(collection, doc) {
    const table = TABLE_MAP[collection] || camelToSnake(collection);
    const colsMap = await getTableColumns();
    const validCols = colsMap[table] || new Set();

    const snakeDoc = {};
    for (const [k, v] of Object.entries(doc)) {
      let snakeKey = camelToSnake(k);
      if (!validCols.has(snakeKey)) {
        if (snakeKey === 'farmer_location' && validCols.has('location')) snakeKey = 'location';
        if (snakeKey === 'buyer_company' && validCols.has('company_name')) snakeKey = 'company_name';
        if (snakeKey === 'seller_type' && validCols.has('seller_role')) snakeKey = 'seller_role';
        if (snakeKey === 'offered_price_per_kg' && validCols.has('buyer_offered_price_per_kg')) snakeKey = 'buyer_offered_price_per_kg';
      }
      if (validCols.has(snakeKey)) {
        snakeDoc[snakeKey] = v;
      }
    }

    if (!snakeDoc.id && validCols.has('id')) {
      snakeDoc.id = `${collection.slice(0, 3)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
    if (!snakeDoc.created_at && validCols.has('created_at')) {
      snakeDoc.created_at = new Date().toISOString();
    }

    const keys = Object.keys(snakeDoc);
    const values = keys.map(k => {
      const val = snakeDoc[k];
      if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
        return JSON.stringify(val);
      }
      return val;
    });

    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const res = await pool.query(sql, values);
    return mapRow(res.rows[0]);
  }

  async updateById(collection, id, updates) {
    const table = TABLE_MAP[collection] || camelToSnake(collection);
    const colsMap = await getTableColumns();
    const validCols = colsMap[table] || new Set();

    const snakeUpdates = {};
    for (const [k, v] of Object.entries(updates)) {
      let snakeKey = camelToSnake(k);
      if (!validCols.has(snakeKey)) {
        if (snakeKey === 'farmer_location' && validCols.has('location')) snakeKey = 'location';
        if (snakeKey === 'buyer_company' && validCols.has('company_name')) snakeKey = 'company_name';
        if (snakeKey === 'seller_type' && validCols.has('seller_role')) snakeKey = 'seller_role';
        if (snakeKey === 'offered_price_per_kg' && validCols.has('buyer_offered_price_per_kg')) snakeKey = 'buyer_offered_price_per_kg';
      }
      if (validCols.has(snakeKey)) {
        snakeUpdates[snakeKey] = v;
      }
    }

    const keys = Object.keys(snakeUpdates);
    if (keys.length === 0) {
      return this.findById(collection, id);
    }

    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = keys.map(k => {
      const val = snakeUpdates[k];
      if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
        return JSON.stringify(val);
      }
      return val;
    });
    values.push(id);

    const sql = `UPDATE ${table} SET ${setClauses} WHERE id = $${values.length} RETURNING *`;
    const res = await pool.query(sql, values);
    return res.rows.length > 0 ? mapRow(res.rows[0]) : null;
  }

  async deleteById(collection, id) {
    const table = TABLE_MAP[collection] || camelToSnake(collection);
    const res = await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    return (res.rowCount || 0) > 0;
  }

  async reset() {
    await pool.query("DELETE FROM farmer_listings WHERE is_demo = false OR (id LIKE 'list-%' AND id NOT IN ('list-101','list-102','list-103','list-104','list-105','list-106'))");
    await pool.query("DELETE FROM buyer_requirements WHERE is_demo = false OR (id LIKE 'req-%' AND id NOT IN ('req-201','req-202','req-203','req-204','req-205'))");
    await pool.query("DELETE FROM users WHERE is_demo = false AND role != 'admin'");
    await pool.query("UPDATE farmer_listings SET status = 'ACTIVE'");
    await pool.query("UPDATE buyer_requirements SET status = 'OPEN'");
    return { success: true };
  }

  async addFarmerToBatch(batchId, farmerData) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const bRes = await client.query('SELECT * FROM aggregation_batches WHERE id = $1 FOR UPDATE', [batchId]);
      if (bRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }
      const batch = mapRow(bRes.rows[0]);
      const farmers = Array.isArray(batch.farmers) ? [...batch.farmers] : [];
      farmers.push({
        listingId: farmerData.listingId,
        farmerId: farmerData.farmerId,
        farmerName: farmerData.farmerName,
        farmerLocation: farmerData.farmerLocation,
        quantityTons: Number(farmerData.quantityTons),
        purchasePricePerKg: Number(farmerData.purchasePricePerKg),
        status: 'COMMITTED'
      });

      let totalTons = 0;
      let totalCost = 0;
      farmers.forEach(f => {
        totalTons += Number(f.quantityTons);
        totalCost += (Number(f.quantityTons) * 1000 * Number(f.purchasePricePerKg));
      });

      const avgPurchasePrice = Number((totalCost / (totalTons * 1000)).toFixed(2));
      const grossMargin = Number((
        batch.buyerSalePricePerKg - (
          avgPurchasePrice +
          (batch.estimatedLogisticsCostPerKg || 0) +
          (batch.estimatedStorageCostPerKg || 0) +
          (batch.estimatedPlatformFeePerKg || 0)
        )
      ).toFixed(2));

      const status = totalTons >= batch.targetQuantityTons ? 'READY_TO_FULFILL' : 'GATHERING';
      const updatedStops = farmers.map((f, i) => `Stop ${i + 1}: ${f.farmerLocation} (${f.farmerName} - ${f.quantityTons}T)`);
      updatedStops.push(`Consolidation Hub: Agra Bypass Hub`);
      updatedStops.push(`Destination: ${batch.buyerName || 'Mandi Terminal'}`);

      const collectionRoute = {
        stops: updatedStops,
        totalDistanceKm: 35 + (farmers.length * 15),
        estimatedTransportCostTotal: 18000 + (farmers.length * 4500),
        estimatedCostPerKg: batch.estimatedLogisticsCostPerKg || 2.4
      };

      // Single atomic UPDATE on aggregation_batches
      const updateRes = await client.query(`
        UPDATE aggregation_batches SET
          farmers = $1,
          current_aggregated_tons = $2,
          farmer_purchase_price_avg = $3,
          estimated_gross_margin_per_kg = $4,
          status = $5,
          collection_route = $6
        WHERE id = $7
        RETURNING *
      `, [
        JSON.stringify(farmers),
        totalTons,
        avgPurchasePrice,
        grossMargin,
        status,
        JSON.stringify(collectionRoute),
        batchId
      ]);

      await client.query('COMMIT');
      return mapRow(updateRes.rows[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

async function findUserByIdentifier(identifier) {
  if (!identifier) return null;
  const raw = String(identifier).trim();
  const lower = raw.toLowerCase();
  const cleanPhone = raw.replace(/\D/g, '').slice(-10);

  const res = await safeQuery(`
    SELECT * FROM users
    WHERE (phone IS NOT NULL AND (phone = $1 OR phone = $2 OR RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) = $3))
       OR (email IS NOT NULL AND LOWER(email) = $4)
       OR (username IS NOT NULL AND LOWER(username) = $4)
       OR (google_id IS NOT NULL AND google_id = $1)
    LIMIT 1
  `, [raw, `+91 ${cleanPhone}`, cleanPhone, lower]);

  if (res.rows.length === 0) return null;
  return mapRow(res.rows[0]);
}

async function findUserByGoogleId(googleId) {
  if (!googleId) return null;
  const res = await safeQuery('SELECT * FROM users WHERE google_id = $1 LIMIT 1', [String(googleId).trim()]);
  if (res.rows.length === 0) return null;
  return mapRow(res.rows[0]);
}

async function findUserById(id) {
  if (!id) return null;
  const res = await safeQuery('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
  if (res.rows.length === 0) return null;
  return mapRow(res.rows[0]);
}

const db = new PostgresDatabaseAdapter();
module.exports = { db, hashPassword, findUserByIdentifier, findUserByGoogleId, findUserById, pool, safeQuery, mapRow };
