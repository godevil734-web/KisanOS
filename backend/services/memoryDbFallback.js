// backend/services/memoryDbFallback.js
// High-resilience In-Memory PostgreSQL Fallback for KisanConnect (when remote database is unreachable)
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

let memPoolInstance = null;
let isInitialized = false;

function hashPassword(pass) {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(pass, salt);
}

function relDate(daysOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

function relTimestamp(daysOffset = 0, hoursOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(d.getHours() + hoursOffset);
  return d.toISOString();
}

async function initMemoryDb() {
  if (isInitialized && memPoolInstance) {
    return memPoolInstance;
  }

  const { newDb, DataType } = require('pg-mem');
  const db = newDb();

  // Register native functions required by KisanConnect queries
  db.public.registerFunction({
    name: 'regexp_replace',
    args: [DataType.text, DataType.text, DataType.text, DataType.text],
    returns: DataType.text,
    implementation: (str, pattern, replacement, flags) => {
      if (!str) return str;
      try {
        return str.replace(new RegExp(pattern, flags || 'g'), replacement);
      } catch (e) {
        return str;
      }
    }
  });

  db.public.registerFunction({
    name: 'right',
    args: [DataType.text, DataType.integer],
    returns: DataType.text,
    implementation: (str, n) => {
      return str ? String(str).slice(-n) : '';
    }
  });

  const { Pool } = db.adapters.createPg();
  const pool = new Pool();

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const migrationFiles = [
    '001_init_schema.sql',
    '002_audit_log_and_admin.sql',
    '003_google_auth.sql',
    '004_email_otp.sql',
    '005_nalamki_activities.sql',
    '006_supply_network_restructure.sql',
    '007_marketplace_deal_lifecycle.sql',
    '008_two_way_offers_negotiation.sql',
    '009_system_settings.sql',
    '010_trader_subtypes_and_escrow_ledger.sql'
  ];

  for (const f of migrationFiles) {
    const fullPath = path.join(migrationsDir, f);
    if (fs.existsSync(fullPath)) {
      let sql = fs.readFileSync(fullPath, 'utf-8');
      sql = sql.replace(/ALTER TABLE .* ENABLE ROW LEVEL SECURITY;/g, '');
      sql = sql.replace(/CREATE POLICY .*/g, '');
      sql = sql.replace(/DROP POLICY .*/g, '');
      sql = sql.replace(/ALTER TABLE .* OWNER TO .*/g, '');
      try {
        await pool.query(sql);
      } catch (err) {
        console.warn(`[MEM DB] Migration warning for ${f}:`, err.message);
      }
    }
  }

  // Seed Admin Account
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@kisanconnect.in').toLowerCase().trim();
  const adminPassword = hashPassword(process.env.ADMIN_PASSWORD || 'AdminSecure#2026!');
  await pool.query(`
    INSERT INTO users (
      id, name, email, phone, role, status, password, verified,
      phone_verified, email_verified, auth_methods, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
  `, [
    'usr-admin-1',
    'Platform Administrator',
    adminEmail,
    '+91 99999 00000',
    'admin',
    'active',
    adminPassword,
    true,
    true,
    true,
    JSON.stringify(['password', 'phone'])
  ]);

  // Seed db.json dataset
  const backupPath = path.join(__dirname, '..', 'data', 'db.json');
  if (fs.existsSync(backupPath)) {
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    const defaultPassword = hashPassword('password123');

    // 1. Crops
    if (Array.isArray(backupData.crops)) {
      for (const c of backupData.crops) {
        try {
          await pool.query(`
            INSERT INTO crops (id, name, category, default_unit, varieties, standard_grades, storage_type, key_quality_params, image)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            c.id, c.name, c.category, c.defaultUnit,
            JSON.stringify(c.varieties || []),
            JSON.stringify(c.standardGrades || []),
            c.storageType,
            JSON.stringify(c.keyQualityParams || {}),
            c.image
          ]);
        } catch (e) {}
      }
    }

    // 2. Subscription plans
    if (Array.isArray(backupData.subscriptionPlans)) {
      for (const p of backupData.subscriptionPlans) {
        try {
          await pool.query(`
            INSERT INTO subscription_plans (
              id, name, price_per_month, price_per_year, max_aggregation_capacity_tons,
              allowed_crops, analytics_access, storage_access, demand_alerts, priority_matching,
              supply_forecasting_access, badge, description
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          `, [
            p.id, p.name, p.pricePerMonth, p.pricePerYear, p.maxAggregationCapacityTons,
            JSON.stringify(p.allowedCrops || []), !!p.analyticsAccess, !!p.storageAccess,
            !!p.demandAlerts, !!p.priorityMatching, !!p.supplyForecastingAccess,
            p.badge, p.description
          ]);
        } catch (e) {}
      }
    }

    // 3. Users
    if (Array.isArray(backupData.users)) {
      for (const u of backupData.users) {
        if (u.role === 'admin' || (u.email && u.email.toLowerCase() === adminEmail)) continue;
        const cleanEmail = u.email ? u.email.toLowerCase().trim() : null;
        const cleanPhone = u.phone ? u.phone.trim() : null;
        try {
          await pool.query(`
            INSERT INTO users (
              id, name, email, phone, role, status, password, location, rating,
              reviews_count, verified, completed_orders, is_demo,
              farmer_profile, aggregator_profile, buyer_profile, business_profile,
              phone_verified, email_verified, auth_methods, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW())
          `, [
            u.id, u.name, cleanEmail, cleanPhone, u.role, u.status || 'active',
            u.password || defaultPassword, u.location || null, u.rating || 0,
            u.reviewsCount || 0, !!u.verified, u.completedOrders || 0, true,
            u.farmerProfile ? JSON.stringify(u.farmerProfile) : null,
            u.aggregatorProfile ? JSON.stringify(u.aggregatorProfile) : null,
            u.buyerProfile ? JSON.stringify(u.buyerProfile) : null,
            u.businessProfile ? JSON.stringify(u.businessProfile) : null,
            true, !!cleanEmail, JSON.stringify(['password', 'phone'])
          ]);
        } catch (e) {}
      }
    }

    // 4. Cold storages
    if (Array.isArray(backupData.coldStorages)) {
      for (const s of backupData.coldStorages) {
        try {
          await pool.query(`
            INSERT INTO cold_storages (
              id, owner_id, name, location, total_capacity_tons, occupied_capacity_tons,
              available_capacity_tons, utilization_percent, storage_charge_per_month_per_ton,
              supported_crops, facilities, status, manager_contact, inventory, is_demo
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          `, [
            s.id, s.ownerId || 'usr-storage-1', s.name, s.location, s.totalCapacityTons, s.occupiedCapacityTons,
            s.availableCapacityTons, s.utilizationPercent, s.storageChargePerMonthPerTon,
            JSON.stringify(s.supportedCrops || []), JSON.stringify(s.facilities || []),
            s.status || 'ACTIVE', s.managerContact, JSON.stringify(s.inventory || []), true
          ]);
        } catch (e) {}
      }
    }

    // 5. Transporters
    if (Array.isArray(backupData.transporters)) {
      for (const t of backupData.transporters) {
        try {
          await pool.query(`
            INSERT INTO transporters (
              id, user_id, transporter_name, company_name, base_location, rating,
              total_trips_completed, vehicles, is_demo
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            t.id, t.userId, t.transporterName, t.companyName, t.baseLocation,
            t.rating || 0, t.totalTripsCompleted || 0, JSON.stringify(t.vehicles || []), true
          ]);
        } catch (e) {}
      }
    }

    // 6. Farmer Listings
    if (Array.isArray(backupData.farmerListings)) {
      for (const l of backupData.farmerListings) {
        try {
          await pool.query(`
            INSERT INTO farmer_listings (
              id, farmer_id, farmer_name, farmer_phone, crop_id, crop_name, variety,
              grade, quantity_tons, quantity_kg, expected_price_per_kg, harvest_date, location,
              latitude, longitude, images, storage_requirement, status, is_demo, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
          `, [
            l.id, l.farmerId, l.farmerName, l.farmerPhone, l.cropId, l.cropName, l.variety,
            l.grade, l.quantityTons, (Number(l.quantityTons) || 0) * 1000, l.expectedPricePerKg,
            relDate(-2), l.location, l.latitude || null, l.longitude || null,
            JSON.stringify(l.images || []), l.storageRequirement, l.status || 'ACTIVE', true,
            relTimestamp(-2)
          ]);
        } catch (e) {}
      }
    }

    // 7. Buyer Requirements
    if (Array.isArray(backupData.buyerRequirements)) {
      for (const r of backupData.buyerRequirements) {
        try {
          await pool.query(`
            INSERT INTO buyer_requirements (
              id, buyer_id, buyer_name, buyer_company, buyer_type, crop_id, crop_name, variety,
              quantity_tons, required_quantity_kg, minimum_direct_farmer_lot_kg, aggregation_allowed,
              unit, grade_required, size_min_mm, size_max_mm, max_moisture,
              max_defects, location, delivery_latitude, delivery_longitude, required_date, offered_price_per_kg, delivery_type,
              status, special_requirements, is_demo, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, true, $27)
          `, [
            r.id, r.buyerId, r.buyerName, r.buyerCompany, r.buyerType || 'bulk',
            r.cropId, r.cropName, r.variety, r.quantityTons,
            r.requiredQuantityKg || (Number(r.quantityTons) || 0) * 1000,
            r.minimumDirectFarmerLotKg || 250, r.aggregationAllowed !== false,
            r.unit || 'tonnes', r.gradeRequired, r.sizeMinMm, r.sizeMaxMm,
            r.maxMoisture, r.maxDefects, r.location, r.deliveryLatitude || null, r.deliveryLongitude || null,
            relDate(10), r.offeredPricePerKg, r.deliveryType, r.status || 'OPEN',
            r.specialRequirements || '', relTimestamp(-2)
          ]);
        } catch (e) {}
      }
    }

    // 8. Aggregation batches
    if (Array.isArray(backupData.aggregationBatches)) {
      for (const b of backupData.aggregationBatches) {
        try {
          await pool.query(`
            INSERT INTO aggregation_batches (
              id, aggregator_id, aggregator_name, buyer_requirement_id, buyer_name,
              crop_name, variety, target_quantity_tons, current_aggregated_tons, status,
              buyer_sale_price_per_kg, estimated_logistics_cost_per_kg, estimated_storage_cost_per_kg,
              estimated_platform_fee_per_kg, farmer_purchase_price_avg, estimated_gross_margin_per_kg,
              farmers, collection_route, is_demo, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
          `, [
            b.id, b.aggregatorId, b.aggregatorName, b.buyerRequirementId, b.buyerName,
            b.cropName, b.variety, b.targetQuantityTons, b.currentAggregatedTons, b.status,
            b.buyerSalePricePerKg, b.estimatedLogisticsCostPerKg, b.estimatedStorageCostPerKg,
            b.estimatedPlatformFeePerKg, b.farmerPurchasePriceAvg, b.estimatedGrossMarginPerKg,
            JSON.stringify(b.farmers || []), JSON.stringify(b.collectionRoute || {}), true
          ]);
        } catch (e) {}
      }
    }

    // 9. Market Prices
    if (Array.isArray(backupData.marketPrices)) {
      for (const mp of backupData.marketPrices) {
        try {
          await pool.query(`
            INSERT INTO market_prices (id, crop_name, variety, mandi, district, state, date, min_price, max_price, modal_price, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          `, [
            mp.id, mp.cropName, mp.variety, mp.mandi, mp.district, mp.state,
            mp.date || relDate(0), mp.minPrice, mp.maxPrice, mp.modalPrice
          ]);
        } catch (e) {}
      }
    }

    // 10. Notifications
    if (Array.isArray(backupData.notifications)) {
      for (const n of backupData.notifications) {
        try {
          await pool.query(`
            INSERT INTO notifications (id, user_id, title, message, type, read, timestamp, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
          `, [n.id, n.userId, n.title, n.message, n.type, !!n.read]);
        } catch (e) {}
      }
    }
  }

  isInitialized = true;
  memPoolInstance = pool;
  console.log('✅ [MEM DB] In-memory PostgreSQL database successfully initialized and seeded.');
  return pool;
}

module.exports = { initMemoryDb };
