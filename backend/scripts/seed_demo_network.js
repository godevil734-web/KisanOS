// backend/scripts/seed_demo_network.js
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

function hashPassword(plainText) {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(plainText, salt);
}

const defaultPassword = hashPassword('password123');

// Acceptance Test Demo Users
const demoUsers = [
  {
    id: 'usr-buyer-local-1',
    name: 'Local Potato Trader',
    email: 'localbuyer@kisanconnect.in',
    phone: '+91 98765 43210',
    role: 'buyer',
    buyer_type: 'local',
    location: 'Kushinagar Main Mandi, UP',
    latitude: 26.791,
    longitude: 83.946,
    buyer_profile: {
      companyName: 'Kushinagar Local Wholesale',
      buyerType: 'local',
      procurementScale: 'regional',
      targetCrops: ['Potato', 'Tomato']
    }
  },
  {
    id: 'usr-buyer-freshbites',
    name: 'FreshBites Foods Pvt Ltd',
    email: 'procurement@freshbites.com',
    phone: '+91 98111 22334',
    role: 'buyer',
    buyer_type: 'bulk',
    location: 'Gorakhpur Agro Processing Park, UP',
    latitude: 26.755,
    longitude: 83.470,
    buyer_profile: {
      companyName: 'FreshBites Foods Pvt Ltd',
      buyerType: 'bulk',
      procurementScale: 'national',
      targetCrops: ['Potato', 'Onion', 'Wheat']
    }
  },
  {
    id: 'usr-buyer-deoria',
    name: 'Deoria Agro Traders',
    email: 'deoria@agro.in',
    phone: '+91 98222 33445',
    role: 'buyer',
    buyer_type: 'local',
    location: 'Deoria Agro Hub, UP',
    latitude: 26.475,
    longitude: 83.770,
    buyer_profile: {
      companyName: 'Deoria Agro Traders',
      buyerType: 'local',
      procurementScale: 'regional'
    }
  },
  {
    id: 'usr-buyer-basti',
    name: 'Basti Wholesale Terminal',
    email: 'basti@wholesale.in',
    phone: '+91 98333 44556',
    role: 'buyer',
    buyer_type: 'bulk',
    location: 'Basti Agro Terminal, UP',
    latitude: 26.800,
    longitude: 83.015,
    buyer_profile: {
      companyName: 'Basti Wholesale Terminal',
      buyerType: 'bulk',
      procurementScale: 'national'
    }
  },
  {
    id: 'usr-farmer-a',
    name: 'Farmer A (Ramesh Verma)',
    email: 'farmer.a@kisanconnect.in',
    phone: '+91 98001 00001',
    role: 'farmer',
    location: 'Kushinagar Rural North, UP',
    latitude: 26.820,
    longitude: 83.959,
    farmer_profile: {
      farmSizeAcres: 3,
      primaryCrops: ['Potato'],
      experienceYears: 12
    }
  },
  {
    id: 'usr-farmer-b',
    name: 'Farmer B (Suresh Yadav)',
    email: 'farmer.b@kisanconnect.in',
    phone: '+91 98002 00002',
    role: 'farmer',
    location: 'Hata Rural, Kushinagar, UP',
    latitude: 26.705,
    longitude: 83.825,
    farmer_profile: {
      farmSizeAcres: 5,
      primaryCrops: ['Potato'],
      experienceYears: 15
    }
  },
  {
    id: 'usr-farmer-c',
    name: 'Farmer C (Mahesh Patel)',
    email: 'farmer.c@kisanconnect.in',
    phone: '+91 98003 00003',
    role: 'farmer',
    location: 'Padrauna Cluster, Kushinagar, UP',
    latitude: 26.850,
    longitude: 84.010,
    farmer_profile: {
      farmSizeAcres: 6,
      primaryCrops: ['Potato'],
      experienceYears: 18
    }
  },
  {
    id: 'usr-farmer-d',
    name: 'Farmer D (Dinesh Kumar)',
    email: 'farmer.d@kisanconnect.in',
    phone: '+91 98004 00004',
    role: 'farmer',
    location: 'Deoria Border, UP',
    latitude: 26.600,
    longitude: 83.750,
    farmer_profile: {
      farmSizeAcres: 8,
      primaryCrops: ['Potato'],
      experienceYears: 20
    }
  },
  {
    id: 'usr-farmer-e',
    name: 'Farmer E (Vikram Choudhary)',
    email: 'farmer.e@kisanconnect.in',
    phone: '+91 98005 00005',
    role: 'farmer',
    location: 'Kasia Rural, Kushinagar, UP',
    latitude: 26.880,
    longitude: 83.720,
    farmer_profile: {
      farmSizeAcres: 12,
      primaryCrops: ['Potato'],
      experienceYears: 22
    }
  },
  {
    id: 'usr-agg-1',
    name: 'Vikram Singh (Kushinagar Hub)',
    email: 'aggregator@kisanconnect.in',
    phone: '+91 98777 88990',
    role: 'aggregator',
    location: 'Kushinagar Aggregation Center, UP',
    latitude: 26.740,
    longitude: 83.889,
    aggregator_profile: {
      companyName: 'Kushinagar Farmers Cooperative',
      serviceRadiusKm: 50,
      totalCapacityTons: 500
    }
  }
];

// Acceptance Test Listings
const demoListings = [
  {
    id: 'list-farmer-a',
    farmer_id: 'usr-farmer-a',
    farmer_name: 'Farmer A (Ramesh Verma)',
    farmer_phone: '+91 98001 00001',
    crop_id: 'crop-potato',
    crop_name: 'Potato',
    variety: 'Kufri Jyoti',
    grade: 'Grade A',
    quantity_tons: 8.0,
    quantity_kg: 8000.0,
    expected_price_per_kg: 18.50,
    location: 'Kushinagar Rural North, UP',
    latitude: 26.820,
    longitude: 83.959,
    harvest_date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    status: 'ACTIVE'
  },
  {
    id: 'list-farmer-b',
    farmer_id: 'usr-farmer-b',
    farmer_name: 'Farmer B (Suresh Yadav)',
    farmer_phone: '+91 98002 00002',
    crop_id: 'crop-potato',
    crop_name: 'Potato',
    variety: 'Kufri Jyoti',
    grade: 'Grade A',
    quantity_tons: 12.0,
    quantity_kg: 12000.0,
    expected_price_per_kg: 18.20,
    location: 'Hata Rural, Kushinagar, UP',
    latitude: 26.705,
    longitude: 83.825,
    harvest_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    status: 'ACTIVE'
  },
  {
    id: 'list-farmer-c',
    farmer_id: 'usr-farmer-c',
    farmer_name: 'Farmer C (Mahesh Patel)',
    farmer_phone: '+91 98003 00003',
    crop_id: 'crop-potato',
    crop_name: 'Potato',
    variety: 'Kufri Jyoti',
    grade: 'Grade A',
    quantity_tons: 15.0,
    quantity_kg: 15000.0,
    expected_price_per_kg: 18.70,
    location: 'Padrauna Cluster, Kushinagar, UP',
    latitude: 26.850,
    longitude: 84.010,
    harvest_date: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
    status: 'ACTIVE'
  },
  {
    id: 'list-farmer-d',
    farmer_id: 'usr-farmer-d',
    farmer_name: 'Farmer D (Dinesh Kumar)',
    farmer_phone: '+91 98004 00004',
    crop_id: 'crop-potato',
    crop_name: 'Potato',
    variety: 'Kufri Jyoti',
    grade: 'Grade A',
    quantity_tons: 20.0,
    quantity_kg: 20000.0,
    expected_price_per_kg: 19.00,
    location: 'Deoria Border, UP',
    latitude: 26.600,
    longitude: 83.750,
    harvest_date: new Date(Date.now() + 6 * 86400000).toISOString().split('T')[0],
    status: 'ACTIVE'
  },
  {
    id: 'list-farmer-e',
    farmer_id: 'usr-farmer-e',
    farmer_name: 'Farmer E (Vikram Choudhary)',
    farmer_phone: '+91 98005 00005',
    crop_id: 'crop-potato',
    crop_name: 'Potato',
    variety: 'Kufri Jyoti',
    grade: 'Grade A',
    quantity_tons: 25.0,
    quantity_kg: 25000.0,
    expected_price_per_kg: 19.20,
    location: 'Kasia Rural, Kushinagar, UP',
    latitude: 26.880,
    longitude: 83.720,
    harvest_date: new Date(Date.now() + 8 * 86400000).toISOString().split('T')[0],
    status: 'ACTIVE'
  }
];

// Acceptance Test Buyer Requirements
const demoRequirements = [
  {
    id: 'req-local-potato-1',
    buyer_id: 'usr-buyer-local-1',
    buyer_name: 'Local Potato Trader',
    buyer_company: 'Kushinagar Local Wholesale',
    buyer_type: 'local',
    crop_id: 'crop-potato',
    crop_name: 'Potato',
    variety: 'Kufri Jyoti',
    quantity_tons: 1.5,
    required_quantity_kg: 1500.0,
    minimum_direct_farmer_lot_kg: 250.0,
    aggregation_allowed: true,
    grade_required: 'Grade A',
    offered_price_per_kg: 19.50,
    location: 'Kushinagar Main Mandi, UP',
    delivery_latitude: 26.791,
    delivery_longitude: 83.946,
    required_date: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
    delivery_type: 'DIRECT_FARM',
    status: 'OPEN',
    special_requirements: 'Freshly harvested, sound tubers, direct farmer lot min 250kg.'
  },
  {
    id: 'req-bulk-freshbites-1',
    buyer_id: 'usr-buyer-freshbites',
    buyer_name: 'FreshBites Foods Pvt Ltd',
    buyer_company: 'FreshBites Foods Pvt Ltd',
    buyer_type: 'bulk',
    crop_id: 'crop-potato',
    crop_name: 'Potato',
    variety: 'Kufri Jyoti',
    quantity_tons: 100.0,
    required_quantity_kg: 100000.0,
    minimum_direct_farmer_lot_kg: 20000.0,
    aggregation_allowed: true,
    grade_required: 'Grade A',
    offered_price_per_kg: 20.00,
    location: 'Gorakhpur Agro Processing Park, UP',
    delivery_latitude: 26.755,
    delivery_longitude: 83.470,
    required_date: '2026-10-20',
    delivery_type: 'DELIVERY_TO_BUYER',
    status: 'OPEN',
    special_requirements: 'Industrial processing batch. Minimum direct lot 20T. Aggregator pooling allowed for smaller lots.'
  },
  {
    id: 'req-buyer-deoria-1',
    buyer_id: 'usr-buyer-deoria',
    buyer_name: 'Deoria Agro Traders',
    buyer_company: 'Deoria Agro Traders',
    buyer_type: 'local',
    crop_id: 'crop-potato',
    crop_name: 'Potato',
    variety: 'Kufri Jyoti',
    quantity_tons: 3.0,
    required_quantity_kg: 3000.0,
    minimum_direct_farmer_lot_kg: 500.0,
    aggregation_allowed: true,
    grade_required: 'Grade A',
    offered_price_per_kg: 19.00,
    location: 'Deoria Agro Hub, UP',
    delivery_latitude: 26.475,
    delivery_longitude: 83.770,
    required_date: new Date(Date.now() + 12 * 86400000).toISOString().split('T')[0],
    delivery_type: 'DIRECT_FARM',
    status: 'OPEN',
    special_requirements: 'Local mandi supply.'
  },
  {
    id: 'req-buyer-basti-1',
    buyer_id: 'usr-buyer-basti',
    buyer_name: 'Basti Wholesale Terminal',
    buyer_company: 'Basti Wholesale Terminal',
    buyer_type: 'bulk',
    crop_id: 'crop-potato',
    crop_name: 'Potato',
    variety: 'Kufri Jyoti',
    quantity_tons: 50.0,
    required_quantity_kg: 50000.0,
    minimum_direct_farmer_lot_kg: 10000.0,
    aggregation_allowed: true,
    grade_required: 'Grade A',
    offered_price_per_kg: 19.80,
    location: 'Basti Agro Terminal, UP',
    delivery_latitude: 26.800,
    delivery_longitude: 83.015,
    required_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    delivery_type: 'DELIVERY_TO_BUYER',
    status: 'OPEN',
    special_requirements: 'Inter-district wholesale procurement.'
  }
];

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL missing');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    max: 2
  });

  const client = await pool.connect();
  console.log('[SEED-NETWORK] Connected to Supabase PostgreSQL.');

  try {
    // 1. Seed Users
    for (const u of demoUsers) {
      await client.query(`
        INSERT INTO users (
          id, name, email, phone, role, buyer_type, location, latitude, longitude,
          status, password, verified, phone_verified, email_verified, auth_methods,
          farmer_profile, aggregator_profile, buyer_profile, is_demo, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, true, true, true, $11, $12, $13, $14, true, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          role = EXCLUDED.role,
          buyer_type = EXCLUDED.buyer_type,
          location = EXCLUDED.location,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          farmer_profile = EXCLUDED.farmer_profile,
          aggregator_profile = EXCLUDED.aggregator_profile,
          buyer_profile = EXCLUDED.buyer_profile,
          updated_at = NOW()
      `, [
        u.id, u.name, u.email, u.phone, u.role, u.buyer_type || null,
        u.location, u.latitude || null, u.longitude || null,
        defaultPassword,
        JSON.stringify(['password', 'phone']),
        u.farmer_profile ? JSON.stringify(u.farmer_profile) : null,
        u.aggregator_profile ? JSON.stringify(u.aggregator_profile) : null,
        u.buyer_profile ? JSON.stringify(u.buyer_profile) : null
      ]);
    }
    console.log(`✅ [SEED-NETWORK] Seeded ${demoUsers.length} network demo users.`);

    // 2. Seed Farmer Listings
    for (const l of demoListings) {
      await client.query(`
        INSERT INTO farmer_listings (
          id, farmer_id, farmer_name, farmer_phone, crop_id, crop_name, variety,
          grade, quantity_tons, quantity_kg, expected_price_per_kg, harvest_date,
          location, latitude, longitude, images, status, is_demo, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, '[]'::jsonb, $16, true, NOW())
        ON CONFLICT (id) DO UPDATE SET
          farmer_name = EXCLUDED.farmer_name,
          farmer_phone = EXCLUDED.farmer_phone,
          crop_name = EXCLUDED.crop_name,
          variety = EXCLUDED.variety,
          grade = EXCLUDED.grade,
          quantity_tons = EXCLUDED.quantity_tons,
          quantity_kg = EXCLUDED.quantity_kg,
          expected_price_per_kg = EXCLUDED.expected_price_per_kg,
          harvest_date = EXCLUDED.harvest_date,
          location = EXCLUDED.location,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          status = EXCLUDED.status
      `, [
        l.id, l.farmer_id, l.farmer_name, l.farmer_phone, l.crop_id, l.crop_name, l.variety,
        l.grade, l.quantity_tons, l.quantity_kg, l.expected_price_per_kg, l.harvest_date,
        l.location, l.latitude, l.longitude, l.status
      ]);
    }
    console.log(`✅ [SEED-NETWORK] Seeded ${demoListings.length} farmer listings.`);

    // 3. Seed Buyer Requirements
    for (const r of demoRequirements) {
      await client.query(`
        INSERT INTO buyer_requirements (
          id, buyer_id, buyer_name, buyer_company, buyer_type, crop_id, crop_name, variety,
          quantity_tons, required_quantity_kg, minimum_direct_farmer_lot_kg, aggregation_allowed,
          grade_required, offered_price_per_kg, location, delivery_latitude, delivery_longitude,
          required_date, delivery_type, status, special_requirements, is_demo, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, true, NOW())
        ON CONFLICT (id) DO UPDATE SET
          buyer_name = EXCLUDED.buyer_name,
          buyer_company = EXCLUDED.buyer_company,
          buyer_type = EXCLUDED.buyer_type,
          crop_name = EXCLUDED.crop_name,
          variety = EXCLUDED.variety,
          quantity_tons = EXCLUDED.quantity_tons,
          required_quantity_kg = EXCLUDED.required_quantity_kg,
          minimum_direct_farmer_lot_kg = EXCLUDED.minimum_direct_farmer_lot_kg,
          aggregation_allowed = EXCLUDED.aggregation_allowed,
          grade_required = EXCLUDED.grade_required,
          offered_price_per_kg = EXCLUDED.offered_price_per_kg,
          location = EXCLUDED.location,
          delivery_latitude = EXCLUDED.delivery_latitude,
          delivery_longitude = EXCLUDED.delivery_longitude,
          required_date = EXCLUDED.required_date,
          status = EXCLUDED.status,
          special_requirements = EXCLUDED.special_requirements
      `, [
        r.id, r.buyer_id, r.buyer_name, r.buyer_company, r.buyer_type, r.crop_id, r.crop_name, r.variety,
        r.quantity_tons, r.required_quantity_kg, r.minimum_direct_farmer_lot_kg, r.aggregation_allowed,
        r.grade_required, r.offered_price_per_kg, r.location, r.delivery_latitude, r.delivery_longitude,
        r.required_date, r.delivery_type, r.status, r.special_requirements
      ]);
    }
    console.log(`✅ [SEED-NETWORK] Seeded ${demoRequirements.length} buyer requirements.`);

  } finally {
    client.release();
    await pool.end();
  }
}

run().then(() => {
  console.log('✅ Demo supply network data seeded successfully.');
  process.exit(0);
}).catch(err => {
  console.error('❌ Failed seeding demo network:', err);
  process.exit(1);
});
