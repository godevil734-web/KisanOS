// backend/scripts/setup-admins-and-5each.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('1. Clearing transactional tables...');
    await pool.query(`
      TRUNCATE TABLE 
        farmer_listings, 
        buyer_requirements, 
        aggregation_batches, 
        storage_bookings, 
        transporter_bookings, 
        cold_storages, 
        transporters, 
        offers, 
        orders, 
        notifications, 
        reviews, 
        audit_log, 
        otps, 
        rate_limits 
      CASCADE;
    `);
    console.log('✅ Cleared all transactional tables.');

    console.log('2. Removing non-admin users...');
    await pool.query(`
      DELETE FROM users 
      WHERE email NOT IN ('admin@kisanconnect.in', 'godevil344@gmail.com');
    `);

    console.log('3. Upserting SuperAdmin godevil344@gmail.com with password Aryan@123...');
    const aryanHash = bcrypt.hashSync('Aryan@123', 10);
    await pool.query(`
      INSERT INTO users (
        id, name, email, phone, role, status, password, verified,
        phone_verified, email_verified, auth_methods, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW(), NOW()
      )
      ON CONFLICT (email) DO UPDATE SET
        password = EXCLUDED.password,
        role = 'admin',
        status = 'active',
        verified = true,
        email_verified = true,
        phone_verified = true,
        updated_at = NOW();
    `, [
      'usr-admin-aryan',
      'Aryan Singh',
      'godevil344@gmail.com',
      '+91 99999 11111',
      'admin',
      'active',
      aryanHash,
      true,
      true,
      true,
      JSON.stringify(['password', 'google', 'phone'])
    ]);
    console.log('✅ Admin account godevil344@gmail.com created/updated.');

    console.log('4. Upserting SuperAdmin admin@kisanconnect.in...');
    const adminHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'AdminSecure#2026!', 10);
    await pool.query(`
      INSERT INTO users (
        id, name, email, phone, role, status, password, verified,
        phone_verified, email_verified, auth_methods, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW(), NOW()
      )
      ON CONFLICT (email) DO UPDATE SET
        password = EXCLUDED.password,
        role = 'admin',
        status = 'active',
        verified = true,
        updated_at = NOW();
    `, [
      'usr-admin-1',
      'Platform Administrator',
      'admin@kisanconnect.in',
      '+91 99999 00000',
      'admin',
      'active',
      adminHash,
      true,
      true,
      true,
      JSON.stringify(['password', 'phone'])
    ]);
    console.log('✅ Admin account admin@kisanconnect.in synchronized.');

    const defaultUserPassword = bcrypt.hashSync('password123', 10);

    console.log('5. Adding 5 Aggregators demo data...');
    const aggregators = [
      {
        id: 'usr-agg-1',
        name: 'Vikram Singh',
        email: 'vikram@aggregator.in',
        phone: '+91 98222 11001',
        location: 'Agra Mandi Hub, Uttar Pradesh',
        aggregatorProfile: {
          businessName: 'ब्रजभूमि किसान एग्रीगेशन केंद्र (Brajbhumi Kisan Hub)',
          operatingRegion: 'Agra - Mathura - Firozabad Belt',
          serviceRadiusKm: 60,
          maxAggregationCapacityTons: 150,
          subscribedPlanId: 'plan-pro',
          subscriptionStatus: 'ACTIVE',
          allowedCrops: ['Potato', 'Mustard', 'Wheat'],
          warehouseLocation: 'Agra Bypass Transport Hub',
          bankVerified: true
        },
        businessProfile: {
          businessName: 'ब्रजभूमि किसान एग्रीगेशन केंद्र',
          contactPerson: 'Vikram Singh',
          city: 'Agra, UP'
        }
      },
      {
        id: 'usr-agg-2',
        name: 'Anita Devi',
        email: 'anita@fpoagro.in',
        phone: '+91 98222 11002',
        location: 'Hathras Agro Complex, Uttar Pradesh',
        aggregatorProfile: {
          businessName: 'यमुना वैली फार्मर प्रोड्यूसर कंपनी (Yamuna Valley FPO)',
          operatingRegion: 'Hathras - Aligarh - Mathura',
          serviceRadiusKm: 50,
          maxAggregationCapacityTons: 100,
          subscribedPlanId: 'plan-basic',
          subscriptionStatus: 'ACTIVE',
          allowedCrops: ['Potato', 'Tomato', 'Wheat'],
          warehouseLocation: 'Hathras Junction Logistics Park',
          bankVerified: true
        },
        businessProfile: {
          businessName: 'यमुना वैली फार्मर प्रोड्यूसर कंपनी',
          contactPerson: 'Anita Devi',
          city: 'Hathras, UP'
        }
      },
      {
        id: 'usr-agg-3',
        name: 'Harish Chandra',
        email: 'harish@kisanmandisamiti.in',
        phone: '+91 98222 11003',
        location: 'Kanpur Central Mandi, Uttar Pradesh',
        aggregatorProfile: {
          businessName: 'अवध किसान संकलन एवं ग्रेडिंग हब (Awadh Kisan Hub)',
          operatingRegion: 'Lucknow - Kanpur - Unnao Corridor',
          serviceRadiusKm: 75,
          maxAggregationCapacityTons: 200,
          subscribedPlanId: 'plan-business',
          subscriptionStatus: 'ACTIVE',
          allowedCrops: ['Rice', 'Wheat', 'Maize'],
          warehouseLocation: 'Kanpur Industrial Agro Estate',
          bankVerified: true
        },
        businessProfile: {
          businessName: 'अवध किसान संकलन एवं ग्रेडिंग हब',
          contactPerson: 'Harish Chandra',
          city: 'Kanpur, UP'
        }
      },
      {
        id: 'usr-agg-4',
        name: 'Dinesh Choudhary',
        email: 'dinesh@agrocollect.in',
        phone: '+91 98222 11004',
        location: 'Bulandshahr Mandi, Uttar Pradesh',
        aggregatorProfile: {
          businessName: 'गंगा-दोआब रूरल एग्रीटेक हब (Ganga Doab Hub)',
          operatingRegion: 'Meerut - Bulandshahr - Aligarh',
          serviceRadiusKm: 55,
          maxAggregationCapacityTons: 120,
          subscribedPlanId: 'plan-pro',
          subscriptionStatus: 'ACTIVE',
          allowedCrops: ['Wheat', 'Maize', 'Rice'],
          warehouseLocation: 'Bulandshahr Cold Storage Corridor',
          bankVerified: true
        },
        businessProfile: {
          businessName: 'गंगा-दोआब रूरल एग्रीटेक हब',
          contactPerson: 'Dinesh Choudhary',
          city: 'Bulandshahr, UP'
        }
      },
      {
        id: 'usr-agg-5',
        name: 'Rajendra Prasad Yadav',
        email: 'rajendra@yadavagrohub.in',
        phone: '+91 98222 11005',
        location: 'Varanasi Rural Mandi, Uttar Pradesh',
        aggregatorProfile: {
          businessName: 'पूर्वांचल किसान एग्रीगेटर्स (Purvanchal Agro Hub)',
          operatingRegion: 'Varanasi - Mirzapur - Ghazipur Belt',
          serviceRadiusKm: 45,
          maxAggregationCapacityTons: 90,
          subscribedPlanId: 'plan-basic',
          subscriptionStatus: 'ACTIVE',
          allowedCrops: ['Tomato', 'Vegetables', 'Rice'],
          warehouseLocation: 'Varanasi Ring Road Agro Park',
          bankVerified: true
        },
        businessProfile: {
          businessName: 'पूर्वांचल किसान एग्रीगेटर्स',
          contactPerson: 'Rajendra Prasad Yadav',
          city: 'Varanasi, UP'
        }
      }
    ];

    for (const a of aggregators) {
      await pool.query(`
        INSERT INTO users (
          id, name, email, phone, role, status, password, verified,
          phone_verified, email_verified, auth_methods, location, rating,
          reviews_count, completed_orders, is_demo, aggregator_profile,
          business_profile, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13,
          $14, $15, $16, $17::jsonb, $18::jsonb, NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          aggregator_profile = EXCLUDED.aggregator_profile,
          business_profile = EXCLUDED.business_profile,
          updated_at = NOW();
      `, [
        a.id, a.name, a.email, a.phone, 'aggregator', 'active', defaultUserPassword,
        true, true, true, JSON.stringify(['password', 'phone']), a.location,
        4.8, 12, 18, true, JSON.stringify(a.aggregatorProfile), JSON.stringify(a.businessProfile)
      ]);
    }
    console.log('✅ Seeded 5 Aggregators.');

    console.log('6. Adding 5 Bulk Dealers demo data...');
    const buyers = [
      {
        id: 'usr-buyer-1',
        name: 'Pooja Mehra',
        email: 'pooja@freshbites.com',
        phone: '+91 98333 22001',
        location: 'Noida Phase-2 Industrial Area, UP',
        buyerProfile: {
          companyName: 'FreshBites Foods Pvt Ltd',
          businessType: 'Industrial Food Processor & Chip Maker',
          gstNumber: '09AAACF4589K1Z4',
          annualDemandTons: 4500,
          preferredDelivery: 'PICKUP_OR_DELIVERY'
        },
        businessProfile: {
          businessName: 'FreshBites Foods Pvt Ltd',
          contactPerson: 'Pooja Mehra',
          city: 'Noida, UP'
        }
      },
      {
        id: 'usr-buyer-2',
        name: 'Sunil Bansal',
        email: 'sunil@apexagro.in',
        phone: '+91 98333 22002',
        location: 'Okhla Wholesale Mandi, Delhi NCR',
        buyerProfile: {
          companyName: 'Apex Agro Supermarkets & Supply Chain',
          businessType: 'Organized Retail Supermarket Chain',
          gstNumber: '07AAACA2398M1Z8',
          annualDemandTons: 6000,
          preferredDelivery: 'DELIVERY_TO_WAREHOUSE'
        },
        businessProfile: {
          businessName: 'Apex Agro Supermarkets & Supply Chain',
          contactPerson: 'Sunil Bansal',
          city: 'New Delhi'
        }
      },
      {
        id: 'usr-buyer-3',
        name: 'Rajat Singhania',
        email: 'rajat@singhaniafoods.in',
        phone: '+91 98333 22003',
        location: 'Kanpur Grain Hub, UP',
        buyerProfile: {
          companyName: 'Singhania Grain Exports & Flour Mills',
          businessType: 'Flour Mills & Export Trader',
          gstNumber: '09AABCS9821L1Z2',
          annualDemandTons: 10000,
          preferredDelivery: 'FARM_GATE_PICKUP'
        },
        businessProfile: {
          businessName: 'Singhania Grain Exports & Flour Mills',
          contactPerson: 'Rajat Singhania',
          city: 'Kanpur, UP'
        }
      },
      {
        id: 'usr-buyer-4',
        name: 'Amitabh Sen',
        email: 'amitabh@naturesbasketagri.in',
        phone: '+91 98333 22004',
        location: 'Azadpur Mandi Complex, Delhi',
        buyerProfile: {
          companyName: 'Nature Fresh Mega Cold Chain & Wholesale',
          businessType: 'Bulk Institutional Wholesaler',
          gstNumber: '07AAACN5542P1Z6',
          annualDemandTons: 8000,
          preferredDelivery: 'DELIVERY_TO_WAREHOUSE'
        },
        businessProfile: {
          businessName: 'Nature Fresh Mega Cold Chain & Wholesale',
          contactPerson: 'Amitabh Sen',
          city: 'Delhi'
        }
      },
      {
        id: 'usr-buyer-5',
        name: 'Sunita Sharma',
        email: 'sunita@sharmatraders.in',
        phone: '+91 98333 22005',
        location: 'Agra APMC Mandi, UP',
        buyerProfile: {
          companyName: 'Sharma Potato & Onion Wholesale Corporation',
          businessType: 'APMC Commission Agent & Bulk Dealer',
          gstNumber: '09AAACS1123J1Z0',
          annualDemandTons: 3200,
          preferredDelivery: 'PICKUP_OR_DELIVERY'
        },
        businessProfile: {
          businessName: 'Sharma Potato & Onion Wholesale Corporation',
          contactPerson: 'Sunita Sharma',
          city: 'Agra, UP'
        }
      }
    ];

    for (const b of buyers) {
      await pool.query(`
        INSERT INTO users (
          id, name, email, phone, role, status, password, verified,
          phone_verified, email_verified, auth_methods, location, rating,
          reviews_count, completed_orders, is_demo, buyer_profile,
          business_profile, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13,
          $14, $15, $16, $17::jsonb, $18::jsonb, NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          buyer_profile = EXCLUDED.buyer_profile,
          business_profile = EXCLUDED.business_profile,
          updated_at = NOW();
      `, [
        b.id, b.name, b.email, b.phone, 'buyer', 'active', defaultUserPassword,
        true, true, true, JSON.stringify(['password', 'phone']), b.location,
        4.9, 24, 30, true, JSON.stringify(b.buyerProfile), JSON.stringify(b.businessProfile)
      ]);
    }
    console.log('✅ Seeded 5 Bulk Dealers (Buyers).');

    console.log('7. Final verification of users by role:');
    const roleCounts = await pool.query(`
      SELECT role, count(*) FROM users GROUP BY role ORDER BY role;
    `);
    console.log(roleCounts.rows);

    console.log('8. Admin Accounts:');
    const admins = await pool.query(`
      SELECT id, name, email, role, status, verified FROM users WHERE role = 'admin';
    `);
    console.log(admins.rows);

    console.log('9. Checking total counts across all other tables:');
    const tables = [
      'farmer_listings', 'buyer_requirements', 'aggregation_batches',
      'cold_storages', 'storage_bookings', 'transporters', 'transporter_bookings',
      'offers', 'orders', 'notifications', 'reviews', 'otps', 'rate_limits'
    ];
    for (const t of tables) {
      const r = await pool.query(`SELECT count(*) FROM "${t}"`);
      console.log(`  ${t.padEnd(25)} : ${r.rows[0].count}`);
    }

    await pool.end();
    console.log('\n🎉 Setup completed successfully!');
  } catch (err) {
    console.error('Fatal setup error:', err);
    await pool.end();
    process.exit(1);
  }
}

main();
