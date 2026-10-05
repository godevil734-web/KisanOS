// backend/seed.js
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

function hashPassword(plainText) {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(plainText, salt);
}

async function seedDatabase() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('FATAL: DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  // Safety guard: refuse to run destructive seed/reset unless DB_ENV === 'dev'
  if (process.env.DB_ENV !== 'dev') {
    console.error(`FATAL: Seeding and reset operations are prohibited unless DB_ENV=dev (Current DB_ENV: "${process.env.DB_ENV || 'undefined'}"). Aborting.`);
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

  console.log(`[SEED] Target database host: ${dbHost}`);

  // Admin password must be provided via environment
  if (!process.env.ADMIN_PASSWORD) {
    console.error('FATAL: ADMIN_PASSWORD environment variable is required to seed the admin account. No default admin password exists.');
    process.exit(1);
  }

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@kisanconnect.in').toLowerCase().trim();
  const adminPassword = hashPassword(process.env.ADMIN_PASSWORD);

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    max: 3
  });

  const client = await pool.connect();

  try {
    console.log('[SEED] Ensuring admin account exists...');
    await client.query(`
      INSERT INTO users (
        id, name, email, phone, role, status, password, verified,
        phone_verified, email_verified, auth_methods, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET
        password = EXCLUDED.password,
        status = 'active',
        verified = true,
        updated_at = NOW()
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
    console.log('✅ [SEED] Admin account admin@kisanconnect.in verified and synchronized.');

    console.log('[SEED] Ensuring second admin account godevil344@gmail.com exists...');
    const aryanPassword = hashPassword('Aryan@123');
    await client.query(`
      INSERT INTO users (
        id, name, email, phone, role, status, password, verified,
        phone_verified, email_verified, auth_methods, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET
        password = EXCLUDED.password,
        role = 'admin',
        status = 'active',
        verified = true,
        updated_at = NOW()
    `, [
      'usr-admin-aryan',
      'Aryan Singh',
      'godevil344@gmail.com',
      '+91 99999 11111',
      'admin',
      'active',
      aryanPassword,
      true,
      true,
      true,
      JSON.stringify(['password', 'google', 'phone'])
    ]);
    console.log('✅ [SEED] Admin account godevil344@gmail.com verified and synchronized.');

    const backupPath = path.join(__dirname, 'data', 'db.json');
    if (!fs.existsSync(backupPath)) {
      console.warn('[SEED] Warning: backend/data/db.json not found. Skipping catalog/demo data insertion.');
      return;
    }

    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));

    // 1. Seed Master Crops Catalog (required for platform operation)
    if (Array.isArray(backupData.crops)) {
      for (const c of backupData.crops) {
        await client.query(`
          INSERT INTO crops (id, name, category, default_unit, varieties, standard_grades, storage_type, key_quality_params, image)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            varieties = EXCLUDED.varieties,
            standard_grades = EXCLUDED.standard_grades,
            image = EXCLUDED.image
        `, [
          c.id, c.name, c.category, c.defaultUnit,
          JSON.stringify(c.varieties || []),
          JSON.stringify(c.standardGrades || []),
          c.storageType,
          JSON.stringify(c.keyQualityParams || {}),
          c.image
        ]);
      }
      console.log(`✅ [SEED] Seeded / verified ${backupData.crops.length} master crops.`);
    }

    // 2. Seed Master Subscription Plans (required for aggregator tiers)
    if (Array.isArray(backupData.subscriptionPlans)) {
      for (const p of backupData.subscriptionPlans) {
        await client.query(`
          INSERT INTO subscription_plans (
            id, name, price_per_month, price_per_year, max_aggregation_capacity_tons,
            allowed_crops, analytics_access, storage_access, demand_alerts, priority_matching,
            supply_forecasting_access, badge, description
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (id) DO UPDATE SET
            price_per_month = EXCLUDED.price_per_month,
            price_per_year = EXCLUDED.price_per_year,
            max_aggregation_capacity_tons = EXCLUDED.max_aggregation_capacity_tons,
            allowed_crops = EXCLUDED.allowed_crops
        `, [
          p.id, p.name, p.pricePerMonth, p.pricePerYear, p.maxAggregationCapacityTons,
          JSON.stringify(p.allowedCrops || []), !!p.analyticsAccess, !!p.storageAccess,
          !!p.demandAlerts, !!p.priorityMatching, !!p.supplyForecastingAccess,
          p.badge, p.description
        ]);
      }
      console.log(`✅ [SEED] Seeded / verified ${backupData.subscriptionPlans.length} master subscription plans.`);
    }

    const isDemoMode = process.env.DEMO_MODE === 'true';
    if (!isDemoMode) {
      console.log('ℹ️ [SEED] DEMO_MODE is false. Demo personas, mock listings, dummy batches, and fake orders skipped. Clean slate active.');
      return;
    }

    console.log('[SEED] DEMO_MODE=true detected. Seeding demo dataset from db.json backup...');
    const defaultPassword = hashPassword('password123');

    // Helper functions for realistic dates relative to today
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

    // 3. Seed Demo Users
    if (Array.isArray(backupData.users)) {
      let seededUsers = 0;
      for (const u of backupData.users) {
        if (u.role === 'admin' || (u.email && u.email.toLowerCase() === adminEmail)) {
          continue; // Admin handled explicitly above
        }

        const cleanEmail = u.email ? u.email.toLowerCase().trim() : null;
        const cleanPhone = u.phone ? u.phone.trim() : null;
        const pwd = u.password || defaultPassword;
        const status = u.status || 'active';

        await client.query(`
          INSERT INTO users (
            id, name, email, phone, role, status, password, location, rating,
            reviews_count, verified, completed_orders, is_demo,
            farmer_profile, aggregator_profile, buyer_profile, business_profile,
            phone_verified, email_verified, auth_methods, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, COALESCE($21::timestamptz, NOW()), NOW())
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            password = EXCLUDED.password,
            status = EXCLUDED.status,
            farmer_profile = EXCLUDED.farmer_profile,
            aggregator_profile = EXCLUDED.aggregator_profile,
            buyer_profile = EXCLUDED.buyer_profile,
            business_profile = EXCLUDED.business_profile,
            updated_at = NOW()
        `, [
          u.id, u.name, cleanEmail, cleanPhone, u.role, status, pwd,
          u.location || null, u.rating || 0, u.reviewsCount || 0,
          !!u.verified, u.completedOrders || 0, true,
          u.farmerProfile ? JSON.stringify(u.farmerProfile) : null,
          u.aggregatorProfile ? JSON.stringify(u.aggregatorProfile) : null,
          u.buyerProfile ? JSON.stringify(u.buyerProfile) : null,
          u.businessProfile ? JSON.stringify(u.businessProfile) : null,
          true, !!cleanEmail, JSON.stringify(['password', 'phone']),
          u.createdAt || null
        ]);
        seededUsers++;
      }
      console.log(`✅ [SEED] Seeded ${seededUsers} demo users.`);
    }

    // 4. Seed Cold Storages
    if (Array.isArray(backupData.coldStorages)) {
      for (const s of backupData.coldStorages) {
        const ownerId = backupData.users.some(u => u.id === s.ownerId) ? s.ownerId : 'usr-storage-1';
        await client.query(`
          INSERT INTO cold_storages (
            id, owner_id, name, location, total_capacity_tons, occupied_capacity_tons,
            available_capacity_tons, utilization_percent, storage_charge_per_month_per_ton,
            supported_crops, facilities, status, manager_contact, inventory, is_demo
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (id) DO UPDATE SET
            total_capacity_tons = EXCLUDED.total_capacity_tons,
            occupied_capacity_tons = EXCLUDED.occupied_capacity_tons,
            available_capacity_tons = EXCLUDED.available_capacity_tons,
            inventory = EXCLUDED.inventory
        `, [
          s.id, ownerId, s.name, s.location, s.totalCapacityTons, s.occupiedCapacityTons,
          s.availableCapacityTons, s.utilizationPercent, s.storageChargePerMonthPerTon,
          JSON.stringify(s.supportedCrops || []), JSON.stringify(s.facilities || []),
          s.status || 'ACTIVE', s.managerContact, JSON.stringify(s.inventory || []), true
        ]);
      }
      console.log(`✅ [SEED] Seeded ${backupData.coldStorages.length} cold storages.`);
    }

    // 5. Seed Transporters
    if (Array.isArray(backupData.transporters)) {
      for (const t of backupData.transporters) {
        await client.query(`
          INSERT INTO transporters (
            id, user_id, transporter_name, company_name, base_location, rating,
            total_trips_completed, vehicles, is_demo
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            vehicles = EXCLUDED.vehicles,
            rating = EXCLUDED.rating
        `, [
          t.id, t.userId, t.transporterName, t.companyName, t.baseLocation,
          t.rating || 0, t.totalTripsCompleted || 0, JSON.stringify(t.vehicles || []), true
        ]);
      }
      console.log(`✅ [SEED] Seeded ${backupData.transporters.length} transporters.`);
    }

    // 6. Seed Farmer Listings
    if (Array.isArray(backupData.farmerListings)) {
      for (const l of backupData.farmerListings) {
        const harvestDate = l.listingType === 'FUTURE_HARVEST' ? relDate(12) : relDate(-3);
        const createdAt = relTimestamp(-3);
        await client.query(`
          INSERT INTO farmer_listings (
            id, farmer_id, farmer_name, farmer_phone, crop_id, crop_name, variety,
            grade, quantity_tons, expected_price_per_kg, harvest_date, location,
            images, storage_requirement, status, is_demo, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (id) DO UPDATE SET
            quantity_tons = EXCLUDED.quantity_tons,
            expected_price_per_kg = EXCLUDED.expected_price_per_kg,
            harvest_date = EXCLUDED.harvest_date,
            status = EXCLUDED.status
        `, [
          l.id, l.farmerId, l.farmerName, l.farmerPhone, l.cropId, l.cropName, l.variety,
          l.grade, l.quantityTons, l.expectedPricePerKg, harvestDate, l.location,
          JSON.stringify(l.images || []), l.storageRequirement, l.status || 'ACTIVE', true,
          createdAt
        ]);
      }
      console.log(`✅ [SEED] Seeded ${backupData.farmerListings.length} farmer listings.`);
    }

    // 7. Seed Buyer Requirements
    if (Array.isArray(backupData.buyerRequirements)) {
      for (const r of backupData.buyerRequirements) {
        const requiredDate = relDate(10);
        const createdAt = relTimestamp(-2);
        await client.query(`
          INSERT INTO buyer_requirements (
            id, buyer_id, buyer_name, buyer_company, crop_id, crop_name, variety,
            quantity_tons, unit, grade_required, size_min_mm, size_max_mm, max_moisture,
            max_defects, location, required_date, offered_price_per_kg, delivery_type,
            status, special_requirements, is_demo, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
          ON CONFLICT (id) DO UPDATE SET
            quantity_tons = EXCLUDED.quantity_tons,
            offered_price_per_kg = EXCLUDED.offered_price_per_kg,
            required_date = EXCLUDED.required_date,
            status = EXCLUDED.status
        `, [
          r.id, r.buyerId, r.buyerName, r.buyerCompany, r.cropId, r.cropName, r.variety,
          r.quantityTons, r.unit || 'tonnes', r.gradeRequired, r.sizeMinMm, r.sizeMaxMm,
          r.maxMoisture, r.maxDefects, r.location, requiredDate, r.offeredPricePerKg,
          r.deliveryType, r.status || 'OPEN', r.specialRequirements || '', true,
          createdAt
        ]);
      }
      console.log(`✅ [SEED] Seeded ${backupData.buyerRequirements.length} buyer requirements.`);
    }

    // 8. Seed Aggregation Batches
    if (Array.isArray(backupData.aggregationBatches)) {
      for (const b of backupData.aggregationBatches) {
        await client.query(`
          INSERT INTO aggregation_batches (
            id, aggregator_id, aggregator_name, buyer_requirement_id, buyer_name,
            crop_name, variety, target_quantity_tons, current_aggregated_tons, status,
            buyer_sale_price_per_kg, estimated_logistics_cost_per_kg, estimated_storage_cost_per_kg,
            estimated_platform_fee_per_kg, farmer_purchase_price_avg, estimated_gross_margin_per_kg,
            farmers, collection_route, is_demo, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, COALESCE($20::timestamptz, NOW()))
          ON CONFLICT (id) DO UPDATE SET
            current_aggregated_tons = EXCLUDED.current_aggregated_tons,
            farmers = EXCLUDED.farmers,
            status = EXCLUDED.status
        `, [
          b.id, b.aggregatorId, b.aggregatorName, b.buyerRequirementId, b.buyerName,
          b.cropName, b.variety, b.targetQuantityTons, b.currentAggregatedTons, b.status,
          b.buyerSalePricePerKg, b.estimatedLogisticsCostPerKg, b.estimatedStorageCostPerKg,
          b.estimatedPlatformFeePerKg, b.farmerPurchasePriceAvg, b.estimatedGrossMarginPerKg,
          JSON.stringify(b.farmers || []), JSON.stringify(b.collectionRoute || {}), true,
          b.createdAt || null
        ]);
      }
      console.log(`✅ [SEED] Seeded ${backupData.aggregationBatches.length} aggregation batches.`);
    }

    // 9. Seed Storage Bookings
    if (Array.isArray(backupData.storageBookings)) {
      for (const sb of backupData.storageBookings) {
        await client.query(`
          INSERT INTO storage_bookings (
            id, storage_id, storage_name, farmer_id, farmer_name, crop_name, variety,
            quantity_tons, entry_date, expected_release_date, duration_months,
            rate_per_ton_per_month, total_storage_charge, status, receipt_number, is_demo, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
          ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status
        `, [
          sb.id, sb.storageId, sb.storageName, sb.farmerId, sb.farmerName, sb.cropName, sb.variety,
          sb.quantityTons, sb.entryDate || null, sb.expectedReleaseDate || null, sb.durationMonths,
          sb.ratePerTonPerMonth, sb.totalStorageCharge, sb.status, sb.receiptNumber, true
        ]);
      }
      console.log(`✅ [SEED] Seeded ${backupData.storageBookings.length} storage bookings.`);
    }

    // 10. Seed Offers
    if (Array.isArray(backupData.offers)) {
      for (const o of backupData.offers) {
        await client.query(`
          INSERT INTO offers (
            id, requirement_id, listing_id, buyer_id, buyer_name, seller_id, seller_name,
            seller_role, crop_name, variety, quantity_tons, buyer_offered_price_per_kg,
            farmer_expected_price_per_kg, status, delivery_terms, message, is_demo, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, COALESCE($18::timestamptz, NOW()))
          ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status
        `, [
          o.id, o.requirementId, o.listingId, o.buyerId, o.buyerName, o.sellerId, o.sellerName,
          o.sellerRole, o.cropName, o.variety, o.quantityTons, o.buyerOfferedPricePerKg,
          o.farmerExpectedPricePerKg, o.status, o.deliveryTerms, o.message, true,
          o.createdAt || null
        ]);
      }
      console.log(`✅ [SEED] Seeded ${backupData.offers.length} offers.`);
    }

    // 11. Seed Orders
    if (Array.isArray(backupData.orders)) {
      for (const ord of backupData.orders) {
        await client.query(`
          INSERT INTO orders (
            id, order_number, buyer_id, buyer_name, seller_type, seller_id, seller_name,
            crop_name, variety, quantity_tons, unit_price_per_kg, produce_total,
            logistics_cost, platform_fee, total_amount, pickup_location, delivery_location,
            transporter_id, transporter_name, status, payment_status, estimated_delivery_date,
            timeline, is_demo, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, COALESCE($25::timestamptz, NOW()))
          ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, timeline = EXCLUDED.timeline
        `, [
          ord.id, ord.orderNumber, ord.buyerId, ord.buyerName, ord.sellerType, ord.sellerId, ord.sellerName,
          ord.cropName, ord.variety, ord.quantityTons, ord.unitPricePerKg, ord.produceTotal,
          ord.logisticsCost, ord.platformFee, ord.totalAmount, ord.pickupLocation, ord.deliveryLocation,
          ord.transporterId, ord.transporterName, ord.status, ord.paymentStatus,
          ord.estimatedDeliveryDate || null, JSON.stringify(ord.timeline || []), true,
          ord.createdAt || null
        ]);
      }
      console.log(`✅ [SEED] Seeded ${backupData.orders.length} orders.`);
    }

    // 12. Seed Market Prices
    if (Array.isArray(backupData.marketPrices)) {
      for (const mp of backupData.marketPrices) {
        const priceDate = relDate(0);
        await client.query(`
          INSERT INTO market_prices (
            id, crop_name, variety, mandi, district, state, date, min_price, max_price, modal_price
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO UPDATE SET modal_price = EXCLUDED.modal_price, date = EXCLUDED.date
        `, [
          mp.id, mp.cropName, mp.variety, mp.mandi, mp.district, mp.state,
          priceDate, mp.minPrice, mp.maxPrice, mp.modalPrice
        ]);
      }
      console.log(`✅ [SEED] Seeded ${backupData.marketPrices.length} market prices.`);
    }

    // 13. Seed Regional Supply Forecasts
    if (Array.isArray(backupData.regionalSupplyForecasts)) {
      for (let i = 0; i < backupData.regionalSupplyForecasts.length; i++) {
        const rf = backupData.regionalSupplyForecasts[i];
        const rfId = rf.id || `rf-${i + 1}`;
        await client.query(`
          INSERT INTO regional_supply_forecasts (
            id, region, crop, estimated_supply_tons, estimated_demand_tons,
            potential_balance, balance_type, harvest_window, confidence_score,
            cold_storage_buffer_tons, recommendation
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO UPDATE SET
            estimated_supply_tons = EXCLUDED.estimated_supply_tons,
            estimated_demand_tons = EXCLUDED.estimated_demand_tons,
            potential_balance = EXCLUDED.potential_balance,
            recommendation = EXCLUDED.recommendation
        `, [
          rfId, rf.region, rf.crop || rf.cropName, rf.estimatedSupplyTons || 0,
          rf.estimatedDemandTons || 0, rf.potentialBalance || 0, rf.balanceType || 'BALANCED',
          rf.harvestWindow || '', rf.confidenceScore || '', rf.coldStorageBufferTons || 0,
          rf.recommendation || ''
        ]);
      }
      console.log(`✅ [SEED] Seeded ${backupData.regionalSupplyForecasts.length} regional forecasts.`);
    }

    // 14. Seed Notifications
    if (Array.isArray(backupData.notifications)) {
      for (const n of backupData.notifications) {
        await client.query(`
          INSERT INTO notifications (id, user_id, title, message, type, read, timestamp)
          VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()))
          ON CONFLICT (id) DO NOTHING
        `, [n.id, n.userId, n.title, n.message, n.type, !!n.read, n.timestamp || null]);
      }
      console.log(`✅ [SEED] Seeded ${backupData.notifications.length} notifications.`);
    }

    // 15. Seed Reviews
    if (Array.isArray(backupData.reviews)) {
      for (const rv of backupData.reviews) {
        await client.query(`
          INSERT INTO reviews (id, target_user_id, reviewer_id, reviewer_name, reviewer_role, order_id, rating, comment, date)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO NOTHING
        `, [
          rv.id, rv.targetUserId, rv.reviewerId, rv.reviewerName, rv.reviewerRole,
          rv.orderId || null, rv.rating, rv.comment, rv.date || null
        ]);
      }
      console.log(`✅ [SEED] Seeded ${backupData.reviews.length} reviews.`);
    }

    console.log('🎉 [SEED] Complete database seeding completed successfully.');
  } catch (err) {
    console.error('❌ [SEED] Seeding failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase, hashPassword };
