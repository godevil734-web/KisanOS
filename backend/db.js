const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_FILE = path.join(__dirname, 'data', 'db.json');

// Helper to hash password synchronously for seed
function hashPassword(pass) {
  return bcrypt.hashSync(pass, 10);
}

function getInitialData() {
  const defaultPassword = hashPassword('password123');
  const adminPassword = hashPassword('admin123');

  return {
    users: [
      {
        id: 'usr-farmer-1',
        name: 'Ramesh Kumar',
        email: 'ramesh@kisan.in',
        password: defaultPassword,
        phone: '+91 98765 43210',
        role: 'farmer',
        location: 'Khandauli, Agra, UP',
        rating: 4.8,
        reviewsCount: 14,
        verified: true,
        completedOrders: 18,
        createdAt: '2025-11-10T10:00:00Z',
        farmerProfile: {
          farmName: 'Kumar Agro Farm',
          acres: 12,
          cropsGrown: ['Potato', 'Wheat', 'Mustard'],
          irrigationType: 'Tube well & Drip',
          historicalYieldPerAcre: 14 // tons
        }
      },
      {
        id: 'usr-farmer-2',
        name: 'Suresh Patel',
        email: 'suresh@kisan.in',
        password: defaultPassword,
        phone: '+91 98765 43211',
        role: 'farmer',
        location: 'Tundla, Firozabad, UP',
        rating: 4.6,
        reviewsCount: 9,
        verified: true,
        completedOrders: 12,
        createdAt: '2025-12-01T10:00:00Z',
        farmerProfile: {
          farmName: 'Suresh Organic Acres',
          acres: 8,
          cropsGrown: ['Potato', 'Tomato', 'Onion'],
          irrigationType: 'Canal & Sprinkler',
          historicalYieldPerAcre: 13
        }
      },
      {
        id: 'usr-farmer-3',
        name: 'Mahendra Yadav',
        email: 'mahendra@kisan.in',
        password: defaultPassword,
        phone: '+91 98765 43212',
        role: 'farmer',
        location: 'Farah, Mathura, UP',
        rating: 4.9,
        reviewsCount: 22,
        verified: true,
        completedOrders: 27,
        createdAt: '2025-10-15T10:00:00Z',
        farmerProfile: {
          farmName: 'Yadav Krishi Kendra',
          acres: 18,
          cropsGrown: ['Potato', 'Wheat', 'Rice'],
          irrigationType: 'Tube well',
          historicalYieldPerAcre: 15
        }
      },
      {
        id: 'usr-agg-1',
        name: 'Vikram Singh',
        email: 'vikram@aggregator.in',
        password: defaultPassword,
        phone: '+91 98111 22334',
        role: 'aggregator',
        location: 'Agra City Mandi Zone, UP',
        rating: 4.9,
        reviewsCount: 38,
        verified: true,
        completedOrders: 45,
        createdAt: '2025-08-20T10:00:00Z',
        aggregatorProfile: {
          businessName: 'Agra Agro Aggregations & Hub',
          operatingRegion: 'Agra - Mathura - Firozabad Belt',
          serviceRadiusKm: 50,
          maxAggregationCapacityTons: 150,
          subscribedPlanId: 'plan-pro',
          subscriptionStatus: 'ACTIVE',
          subscriptionExpiresAt: '2026-12-31T23:59:59Z',
          allowedCrops: ['Potato', 'Onion', 'Tomato', 'Wheat', 'Maize'],
          warehouseLocation: 'Agra Bypass Transport Hub',
          bankVerified: true
        }
      },
      {
        id: 'usr-agg-2',
        name: 'Anita Devi',
        email: 'anita@aggregator.in',
        password: defaultPassword,
        phone: '+91 98222 33445',
        role: 'aggregator',
        location: 'Kanpur Rural Hub, UP',
        rating: 4.7,
        reviewsCount: 16,
        verified: true,
        completedOrders: 20,
        createdAt: '2025-11-05T10:00:00Z',
        aggregatorProfile: {
          businessName: 'Kalyan Agro Collectives',
          operatingRegion: 'Kanpur - Lucknow Cluster',
          serviceRadiusKm: 60,
          maxAggregationCapacityTons: 80,
          subscribedPlanId: 'plan-basic',
          subscriptionStatus: 'ACTIVE',
          subscriptionExpiresAt: '2026-07-30T23:59:59Z',
          allowedCrops: ['Potato', 'Wheat', 'Rice', 'Pulses'],
          warehouseLocation: 'Kanpur Industrial Area',
          bankVerified: true
        }
      },
      {
        id: 'usr-buyer-1',
        name: 'Pooja Mehra',
        email: 'pooja@freshbites.com',
        password: defaultPassword,
        phone: '+91 98333 44556',
        role: 'buyer',
        location: 'Okhla Industrial Area, New Delhi',
        rating: 4.9,
        reviewsCount: 52,
        verified: true,
        completedOrders: 64,
        createdAt: '2025-07-10T10:00:00Z',
        buyerProfile: {
          companyName: 'FreshBites Foods Pvt Ltd',
          businessType: 'Food Processor & Snack Manufacturer',
          gstNumber: '07AAACF2918P1Z8',
          annualDemandTons: 2500,
          preferredDelivery: 'PICKUP_OR_DELIVERY'
        }
      },
      {
        id: 'usr-buyer-2',
        name: 'Sunil Bansal',
        email: 'sunil@apexagro.in',
        password: defaultPassword,
        phone: '+91 98444 55667',
        role: 'buyer',
        location: 'Azadpur Mandi, Delhi',
        rating: 4.7,
        reviewsCount: 30,
        verified: true,
        completedOrders: 41,
        createdAt: '2025-09-12T10:00:00Z',
        buyerProfile: {
          companyName: 'Apex Wholesale Agri Trade',
          businessType: 'Large Wholesaler & Mandi Distributor',
          gstNumber: '07BBBPF4412K2Z1',
          annualDemandTons: 5000,
          preferredDelivery: 'DELIVERY_TO_BUYER'
        }
      },
      {
        id: 'usr-storage-1',
        name: 'Harish Chawla',
        email: 'harish@agracold.in',
        password: defaultPassword,
        phone: '+91 98555 66778',
        role: 'cold_storage',
        location: 'Shamshabad Road, Agra, UP',
        rating: 4.8,
        reviewsCount: 42,
        verified: true,
        completedOrders: 58,
        createdAt: '2025-06-01T10:00:00Z'
      },
      {
        id: 'usr-trans-1',
        name: 'Manoj Yadav',
        email: 'manoj@kisanexpress.in',
        password: defaultPassword,
        phone: '+91 98666 77889',
        role: 'transporter',
        location: 'Agra National Highway 19, UP',
        rating: 4.9,
        reviewsCount: 35,
        verified: true,
        completedOrders: 72,
        createdAt: '2025-06-15T10:00:00Z'
      },
      {
        id: 'usr-admin-1',
        name: 'Platform Administrator',
        email: 'admin@kisanconnect.in',
        password: adminPassword,
        phone: '+91 99999 00000',
        role: 'admin',
        location: 'National Agri Tech Center, New Delhi',
        rating: 5.0,
        reviewsCount: 100,
        verified: true,
        completedOrders: 500,
        createdAt: '2025-01-01T00:00:00Z'
      }
    ],

    crops: [
      {
        id: 'crop-potato',
        name: 'Potato',
        category: 'Vegetables',
        defaultUnit: 'tonnes',
        varieties: ['Kufri Jyoti', 'Kufri Chipsona', 'Kufri Pukhraj', 'Kufri Bahar', 'LR (Lady Rosetta)'],
        standardGrades: ['Grade A (45-75mm, clean, zero sprout)', 'Grade B (35-45mm, minor blemish)', 'Grade C (Seed/Small <35mm)'],
        storageType: 'Cold Storage (3-4°C, 90-95% RH)',
        shelfLifeDaysFresh: 25,
        shelfLifeDaysColdStored: 240,
        keyQualityParams: ['Size (mm)', 'Dry Matter %', 'Sugar Content', 'Skin Defect %', 'Sprout Condition'],
        image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&auto=format&fit=crop&q=60'
      },
      {
        id: 'crop-onion',
        name: 'Onion',
        category: 'Vegetables',
        defaultUnit: 'tonnes',
        varieties: ['Nashik Red', 'Garwa Late Kharif', 'Pusa White', 'Bhima Super'],
        standardGrades: ['Grade A (50-70mm, tight skin)', 'Grade B (40-50mm)', 'Grade C (<40mm)'],
        storageType: 'Dry Ventilated Kanda Chawl (Ambient, low humidity)',
        shelfLifeDaysFresh: 20,
        shelfLifeDaysColdStored: 180,
        keyQualityParams: ['Size (mm)', 'Dry Outer Scales', 'Moisture %', 'Rotten Bulbs %'],
        image: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=500&auto=format&fit=crop&q=60'
      },
      {
        id: 'crop-tomato',
        name: 'Tomato',
        category: 'Vegetables',
        defaultUnit: 'tonnes',
        varieties: ['Himsona Hybrid', 'Abhinav', 'Vaishnavi F1', 'Desi Round'],
        standardGrades: ['Grade A (Firm, Breaker/Turning stage, 60-80mm)', 'Grade B (Pink/Light Red, minor spots)', 'Grade C (Ripe/Processing)'],
        storageType: 'Controlled Atmosphere / Chilled (10-12°C)',
        shelfLifeDaysFresh: 7,
        shelfLifeDaysColdStored: 21,
        keyQualityParams: ['Firmness', 'Color Breaker Stage', 'Size (mm)', 'Blemish Free %'],
        image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&auto=format&fit=crop&q=60'
      },
      {
        id: 'crop-wheat',
        name: 'Wheat',
        category: 'Grains',
        defaultUnit: 'tonnes',
        varieties: ['Sharbati Premium', 'Lokwan', 'HD-2967', 'PBW-502'],
        standardGrades: ['Grade A (Lustrous, Moisture <11%, Foreign matter <0.5%)', 'Grade B (Moisture <12%)', 'Grade C (Feed grain)'],
        storageType: 'Silo / Hermetic Bag / Warehouse',
        shelfLifeDaysFresh: 365,
        shelfLifeDaysColdStored: 730,
        keyQualityParams: ['Moisture %', 'Gluten Content %', 'Grain Lustre', 'Foreign Matter %'],
        image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=500&auto=format&fit=crop&q=60'
      },
      {
        id: 'crop-rice',
        name: 'Rice (Paddy & Milled)',
        category: 'Grains',
        defaultUnit: 'tonnes',
        varieties: ['Basmati 1121', 'Pusa 1509', 'Sona Masoori', 'Govindbhog'],
        standardGrades: ['Grade A (Extra Long Grain, Broken <1%)', 'Grade B (Broken <5%)', 'Grade C (Broken 10-15%)'],
        storageType: 'Dry Grain Warehouse',
        shelfLifeDaysFresh: 500,
        shelfLifeDaysColdStored: 900,
        keyQualityParams: ['Grain Length (mm)', 'Broken %', 'Aroma Score', 'Moisture %'],
        image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=60'
      },
      {
        id: 'crop-maize',
        name: 'Maize (Corn)',
        category: 'Grains',
        defaultUnit: 'tonnes',
        varieties: ['Pioneer 30V92', 'DKC 9108', 'Sweet Corn Yellow'],
        standardGrades: ['Grade A (Aflatoxin <10ppb, Moisture <13%)', 'Grade B (Feed grade)'],
        storageType: 'Dry Grain Storage',
        shelfLifeDaysFresh: 180,
        shelfLifeDaysColdStored: 365,
        keyQualityParams: ['Moisture %', 'Aflatoxin ppb', 'Damaged Grains %'],
        image: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=500&auto=format&fit=crop&q=60'
      },
      {
        id: 'crop-mango',
        name: 'Mango',
        category: 'Fruits',
        defaultUnit: 'tonnes',
        varieties: ['Dasheri', 'Chausa', 'Langra', 'Alphonso'],
        standardGrades: ['Grade A (Export/Retail, 200-300g, spotless)', 'Grade B (Local retail)', 'Grade C (Pulp processing)'],
        storageType: 'Ripening Chamber / Cold Room (12-14°C)',
        shelfLifeDaysFresh: 8,
        shelfLifeDaysColdStored: 25,
        keyQualityParams: ['Brix (Sugar %)', 'Maturity Stage', 'Average Weight (g)', 'Pest Free %'],
        image: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=500&auto=format&fit=crop&q=60'
      }
    ],

    farmerListings: [
      {
        id: 'list-101',
        farmerId: 'usr-farmer-1',
        farmerName: 'Ramesh Kumar',
        farmerPhone: '+91 98765 43210',
        farmerLocation: 'Khandauli, Agra, UP',
        cropId: 'crop-potato',
        cropName: 'Potato',
        variety: 'Kufri Jyoti',
        quantityTons: 15,
        listingType: 'AVAILABLE_NOW',
        availableDate: '2026-09-20',
        harvestDate: '2026-09-15',
        grade: 'Grade A',
        sizeMinMm: 50,
        sizeMaxMm: 70,
        moisturePercent: 18,
        defectsPercent: 2.1,
        expectedPricePerKg: 18.5,
        storageRequirement: 'NONE',
        verificationStatus: 'VERIFIED',
        verifier: 'Agra APMC Quality Cell',
        status: 'ACTIVE',
        images: ['https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&auto=format&fit=crop&q=60'],
        notes: 'High dry-matter table potato, harvested in prime condition, graded with mechanical grader.'
      },
      {
        id: 'list-102',
        farmerId: 'usr-farmer-1',
        farmerName: 'Ramesh Kumar',
        farmerPhone: '+91 98765 43210',
        farmerLocation: 'Khandauli, Agra, UP',
        cropId: 'crop-potato',
        cropName: 'Potato',
        variety: 'Kufri Chipsona',
        quantityTons: 25,
        listingType: 'FUTURE_HARVEST',
        harvestDate: '2026-10-15',
        availableDate: '2026-10-18',
        grade: 'Grade A',
        sizeMinMm: 55,
        sizeMaxMm: 80,
        moisturePercent: 17,
        defectsPercent: 1.5,
        expectedPricePerKg: 20.0,
        storageRequirement: 'COLD_STORAGE',
        verificationStatus: 'SELF_DECLARED',
        status: 'ACTIVE',
        images: ['https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&auto=format&fit=crop&q=60'],
        notes: 'Dedicated crisping variety for chip manufacturers. Low reducing sugar content guarantee.'
      },
      {
        id: 'list-103',
        farmerId: 'usr-farmer-2',
        farmerName: 'Suresh Patel',
        farmerPhone: '+91 98765 43211',
        farmerLocation: 'Tundla, Firozabad, UP',
        cropId: 'crop-potato',
        cropName: 'Potato',
        variety: 'Kufri Jyoti',
        quantityTons: 12,
        listingType: 'AVAILABLE_NOW',
        availableDate: '2026-09-22',
        harvestDate: '2026-09-18',
        grade: 'Grade A',
        sizeMinMm: 48,
        sizeMaxMm: 68,
        moisturePercent: 19,
        defectsPercent: 3.0,
        expectedPricePerKg: 18.0,
        storageRequirement: 'NONE',
        verificationStatus: 'VERIFIED',
        verifier: 'Vikram Singh (Local Aggregator)',
        status: 'ACTIVE',
        images: ['https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&auto=format&fit=crop&q=60'],
        notes: 'Well-cured skin, packed in 50kg leno mesh bags ready for loading.'
      },
      {
        id: 'list-104',
        farmerId: 'usr-farmer-3',
        farmerName: 'Mahendra Yadav',
        farmerPhone: '+91 98765 43212',
        farmerLocation: 'Farah, Mathura, UP',
        cropId: 'crop-potato',
        cropName: 'Potato',
        variety: 'Kufri Bahar',
        quantityTons: 20,
        listingType: 'AVAILABLE_NOW',
        availableDate: '2026-09-24',
        harvestDate: '2026-09-19',
        grade: 'Grade A',
        sizeMinMm: 50,
        sizeMaxMm: 75,
        moisturePercent: 18.5,
        defectsPercent: 2.5,
        expectedPricePerKg: 18.2,
        storageRequirement: 'NONE',
        verificationStatus: 'VERIFIED',
        verifier: 'Agra APMC Quality Cell',
        status: 'ACTIVE',
        images: ['https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&auto=format&fit=crop&q=60'],
        notes: 'Excellent round white tubers, ideal for institutional kitchens or wholesale retail.'
      },
      {
        id: 'list-105',
        farmerId: 'usr-farmer-2',
        farmerName: 'Suresh Patel',
        farmerPhone: '+91 98765 43211',
        farmerLocation: 'Tundla, Firozabad, UP',
        cropId: 'crop-tomato',
        cropName: 'Tomato',
        variety: 'Himsona Hybrid',
        quantityTons: 8,
        listingType: 'AVAILABLE_NOW',
        availableDate: '2026-09-24',
        harvestDate: '2026-09-23',
        grade: 'Grade A',
        sizeMinMm: 55,
        sizeMaxMm: 70,
        moisturePercent: 92,
        defectsPercent: 1.0,
        expectedPricePerKg: 24.0,
        storageRequirement: 'NONE',
        verificationStatus: 'SELF_DECLARED',
        status: 'ACTIVE',
        images: ['https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&auto=format&fit=crop&q=60'],
        notes: 'Plucked at breaker stage for prolonged shelf life during transit.'
      },
      {
        id: 'list-106',
        farmerId: 'usr-farmer-3',
        farmerName: 'Mahendra Yadav',
        farmerPhone: '+91 98765 43212',
        farmerLocation: 'Farah, Mathura, UP',
        cropId: 'crop-wheat',
        cropName: 'Wheat',
        variety: 'Sharbati Premium',
        quantityTons: 30,
        listingType: 'AVAILABLE_NOW',
        availableDate: '2026-09-10',
        harvestDate: '2026-05-20',
        grade: 'Grade A',
        sizeMinMm: 0,
        sizeMaxMm: 0,
        moisturePercent: 10.5,
        defectsPercent: 0.4,
        expectedPricePerKg: 27.5,
        storageRequirement: 'DRY_VENTILATED',
        verificationStatus: 'VERIFIED',
        verifier: 'State Quality Inspector',
        status: 'ACTIVE',
        images: ['https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=500&auto=format&fit=crop&q=60'],
        notes: 'Stored in hermetic steel silo, high protein content, zero weevil infestation.'
      }
    ],

    buyerRequirements: [
      {
        id: 'req-201',
        buyerId: 'usr-buyer-1',
        buyerName: 'Pooja Mehra',
        buyerCompany: 'FreshBites Foods Pvt Ltd',
        cropId: 'crop-potato',
        cropName: 'Potato',
        variety: 'Kufri Jyoti',
        quantityTons: 60,
        unit: 'tonnes',
        gradeRequired: 'Grade A',
        sizeMinMm: 45,
        sizeMaxMm: 75,
        maxMoisture: 20,
        maxDefects: 3.5,
        location: 'Agra Delivery Hub / Farm Pickup',
        requiredDate: '2026-10-05',
        offeredPricePerKg: 21.0,
        deliveryType: 'PICKUP_REQUIRED',
        status: 'OPEN',
        specialRequirements: 'Urgent bulk batch needed for food processing plant. Can be aggregated from multiple farmers.'
      },
      {
        id: 'req-202',
        buyerId: 'usr-buyer-2',
        buyerName: 'Sunil Bansal',
        buyerCompany: 'Apex Wholesale Agri Trade',
        cropId: 'crop-potato',
        cropName: 'Potato',
        variety: 'Kufri Bahar',
        quantityTons: 100,
        unit: 'tonnes',
        gradeRequired: 'Grade A',
        sizeMinMm: 50,
        sizeMaxMm: 80,
        maxMoisture: 19,
        maxDefects: 3.0,
        location: 'Azadpur Mandi Gate 4, Delhi',
        requiredDate: '2026-10-10',
        offeredPricePerKg: 22.5,
        deliveryType: 'DELIVERY_TO_BUYER',
        status: 'OPEN',
        specialRequirements: 'Prefer unified aggregator consolidation with verified quality check.'
      },
      {
        id: 'req-203',
        buyerId: 'usr-buyer-1',
        buyerName: 'Pooja Mehra',
        buyerCompany: 'FreshBites Foods Pvt Ltd',
        cropId: 'crop-potato',
        cropName: 'Potato',
        variety: 'Kufri Chipsona',
        quantityTons: 40,
        unit: 'tonnes',
        gradeRequired: 'Grade A',
        sizeMinMm: 55,
        sizeMaxMm: 85,
        maxMoisture: 18,
        maxDefects: 2.0,
        location: 'Greater Noida Processing Facility',
        requiredDate: '2026-10-25',
        offeredPricePerKg: 23.0,
        deliveryType: 'DELIVERY_TO_BUYER',
        status: 'OPEN',
        specialRequirements: 'Contract procurement for potato chips production line. High dry matter essential.'
      },
      {
        id: 'req-204',
        buyerId: 'usr-buyer-2',
        buyerName: 'Sunil Bansal',
        buyerCompany: 'Apex Wholesale Agri Trade',
        cropId: 'crop-tomato',
        cropName: 'Tomato',
        variety: 'Himsona Hybrid',
        quantityTons: 15,
        unit: 'tonnes',
        gradeRequired: 'Grade A',
        sizeMinMm: 50,
        sizeMaxMm: 75,
        maxMoisture: 93,
        maxDefects: 2.0,
        location: 'Delhi NCR Transit Center',
        requiredDate: '2026-09-28',
        offeredPricePerKg: 26.5,
        deliveryType: 'DELIVERY_TO_BUYER',
        status: 'OPEN',
        specialRequirements: 'Immediate shipment in ventilated plastic crates.'
      }
    ],

    aggregationBatches: [
      {
        id: 'batch-301',
        aggregatorId: 'usr-agg-1',
        aggregatorName: 'Vikram Singh (Agra Agro Aggregations)',
        buyerRequirementId: 'req-201',
        buyerName: 'FreshBites Foods Pvt Ltd',
        cropName: 'Potato',
        variety: 'Kufri Jyoti',
        targetQuantityTons: 60,
        currentAggregatedTons: 47,
        status: 'GATHERING',
        buyerSalePricePerKg: 21.0,
        estimatedLogisticsCostPerKg: 0.85,
        estimatedStorageCostPerKg: 0.25,
        estimatedPlatformFeePerKg: 0.15,
        farmerPurchasePriceAvg: 18.25,
        estimatedGrossMarginPerKg: 1.50, // 21 - (18.25 + 0.85 + 0.25 + 0.15)
        farmers: [
          {
            listingId: 'list-101',
            farmerId: 'usr-farmer-1',
            farmerName: 'Ramesh Kumar',
            farmerLocation: 'Khandauli, Agra',
            quantityTons: 15,
            purchasePricePerKg: 18.5,
            status: 'COMMITTED'
          },
          {
            listingId: 'list-103',
            farmerId: 'usr-farmer-2',
            farmerName: 'Suresh Patel',
            farmerLocation: 'Tundla, Firozabad',
            quantityTons: 12,
            purchasePricePerKg: 18.0,
            status: 'COMMITTED'
          },
          {
            listingId: 'list-104',
            farmerId: 'usr-farmer-3',
            farmerName: 'Mahendra Yadav',
            farmerLocation: 'Farah, Mathura',
            quantityTons: 20,
            purchasePricePerKg: 18.2,
            status: 'COMMITTED'
          }
        ],
        collectionRoute: {
          stops: [
            'Stop 1: Farah, Mathura (Mahendra Yadav - 20T)',
            'Stop 2: Khandauli, Agra (Ramesh Kumar - 15T)',
            'Stop 3: Tundla, Firozabad (Suresh Patel - 12T)',
            'Consolidation Hub: Agra Bypass Hub',
            'Destination: FreshBites Processing'
          ],
          totalDistanceKm: 68,
          estimatedTransportCostTotal: 39950,
          estimatedCostPerKg: 0.85
        },
        createdAt: '2026-09-23T14:30:00Z'
      }
    ],

    coldStorages: [
      {
        id: 'cs-401',
        ownerId: 'usr-storage-1',
        name: 'Agra Imperial Cold Logistics & CA Store',
        location: 'Shamshabad Road, Agra, UP (NH-19 Bypass)',
        totalCapacityTons: 10000,
        occupiedCapacityTons: 7500,
        availableCapacityTons: 2500,
        utilizationPercent: 75,
        storageChargePerMonthPerTon: 450, // approx ₹0.45/kg/month
        supportedCrops: ['Potato', 'Apple', 'Carrot', 'Ginger'],
        facilities: [
          'Pre-cooling Chamber',
          'Humidity Controlled 95% RH',
          'Automated Grading Line',
          '24x7 Generator Backup',
          'Digital Inventory Receipt'
        ],
        status: 'ACTIVE',
        managerContact: '+91 98555 66778',
        inventory: [
          {
            cropName: 'Potato',
            variety: 'Kufri Jyoti & LR',
            quantityTons: 6000,
            occupiedPercent: 60,
            expectedReleaseMonths: [
              { month: 'October 2026', quantityTons: 1200 },
              { month: 'November 2026', quantityTons: 2800 },
              { month: 'December 2026', quantityTons: 2000 }
            ]
          },
          {
            cropName: 'Onion',
            variety: 'Nashik Red',
            quantityTons: 900,
            occupiedPercent: 9,
            expectedReleaseMonths: [
              { month: 'October 2026', quantityTons: 500 },
              { month: 'November 2026', quantityTons: 400 }
            ]
          },
          {
            cropName: 'Other Produce (Apples & Garlic)',
            variety: 'Mixed',
            quantityTons: 600,
            occupiedPercent: 6,
            expectedReleaseMonths: [
              { month: 'October 2026', quantityTons: 600 }
            ]
          }
        ]
      },
      {
        id: 'cs-402',
        ownerId: 'usr-storage-2',
        name: 'Mathura Shital Agrotech Cold Storage',
        location: 'Goverdhan Road, Mathura, UP',
        totalCapacityTons: 6000,
        occupiedCapacityTons: 4200,
        availableCapacityTons: 1800,
        utilizationPercent: 70,
        storageChargePerMonthPerTon: 420,
        supportedCrops: ['Potato', 'Onion', 'Spices'],
        facilities: [
          'Ethylene Scrubbers',
          'Weighbridge on premise',
          'Cold Chain Fleet Parking',
          'Insurance Covered'
        ],
        status: 'ACTIVE',
        managerContact: '+91 98444 33221',
        inventory: [
          {
            cropName: 'Potato',
            variety: 'Kufri Bahar',
            quantityTons: 3500,
            occupiedPercent: 58,
            expectedReleaseMonths: [
              { month: 'October 2026', quantityTons: 1500 },
              { month: 'November 2026', quantityTons: 2000 }
            ]
          },
          {
            cropName: 'Onion',
            variety: 'Garwa',
            quantityTons: 700,
            occupiedPercent: 12,
            expectedReleaseMonths: [
              { month: 'October 2026', quantityTons: 700 }
            ]
          }
        ]
      }
    ],

    storageBookings: [
      {
        id: 'sb-501',
        storageId: 'cs-401',
        storageName: 'Agra Imperial Cold Logistics & CA Store',
        farmerId: 'usr-farmer-1',
        farmerName: 'Ramesh Kumar',
        cropName: 'Potato',
        variety: 'Kufri Chipsona',
        quantityTons: 20,
        entryDate: '2026-08-15',
        expectedReleaseDate: '2026-11-15',
        durationMonths: 3,
        ratePerTonPerMonth: 450,
        totalStorageCharge: 27000,
        status: 'ACTIVE',
        receiptNumber: 'AICL-2026-8812'
      }
    ],

    transporters: [
      {
        id: 'trp-601',
        userId: 'usr-trans-1',
        transporterName: 'Manoj Yadav',
        companyName: 'Kisan Express Agri Freight',
        baseLocation: 'Agra NH-19 Transit Circle',
        rating: 4.9,
        totalTripsCompleted: 142,
        vehicles: [
          {
            id: 'veh-01',
            registrationNumber: 'UP 80 BT 4421',
            vehicleType: 'Eicher Canter 17ft (Ventilated)',
            capacityTons: 6,
            currentLocation: 'Agra Mandi Area',
            availability: 'AVAILABLE',
            ratePerKm: 34,
            baseCharge: 1200,
            suitedCrops: ['Potato', 'Tomato', 'Onion', 'Vegetables']
          },
          {
            id: 'veh-02',
            registrationNumber: 'UP 80 CT 9901',
            vehicleType: 'Tata 16-Wheeler Heavy Truck',
            capacityTons: 22,
            currentLocation: 'Agra Bypass Transport Nagar',
            availability: 'AVAILABLE',
            ratePerKm: 68,
            baseCharge: 3500,
            suitedCrops: ['Potato (Bulk)', 'Wheat', 'Rice', 'Grains']
          },
          {
            id: 'veh-03',
            registrationNumber: 'UP 80 ET 1122',
            vehicleType: 'Mahindra Bolero Maxi Truck',
            capacityTons: 2,
            currentLocation: 'Khandauli Village Link',
            availability: 'AVAILABLE',
            ratePerKm: 22,
            baseCharge: 800,
            suitedCrops: ['Small Aggregations', 'Tomato', 'Vegetables']
          }
        ]
      }
    ],

    subscriptionPlans: [
      {
        id: 'plan-basic',
        name: 'Basic Aggregator',
        monthlyPrice: 499,
        yearlyPrice: 4999,
        maxFarmers: 25,
        maxActiveBatches: 3,
        maxRegions: 1,
        maxAggregationCapacityTons: 50,
        allowedCrops: ['Potato', 'Onion', 'Tomato'],
        analyticsAccess: false,
        storageAccess: false,
        demandAlerts: false,
        priorityMatching: false,
        badge: 'Starter',
        description: 'Ideal for local village aggregators starting out in a single district.'
      },
      {
        id: 'plan-pro',
        name: 'Professional Aggregator',
        monthlyPrice: 999,
        yearlyPrice: 9990,
        maxFarmers: 100,
        maxActiveBatches: 10,
        maxRegions: 3,
        maxAggregationCapacityTons: 200,
        allowedCrops: ['All 10+ Agricultural Commodities'],
        analyticsAccess: true,
        storageAccess: true,
        demandAlerts: true,
        priorityMatching: true,
        badge: 'Most Popular',
        description: 'For active mandi brokers & consolidation centers scaling cross-district aggregation.'
      },
      {
        id: 'plan-business',
        name: 'Business Aggregator',
        monthlyPrice: 1999,
        yearlyPrice: 19990,
        maxFarmers: 500,
        maxActiveBatches: 50,
        maxRegions: 10,
        maxAggregationCapacityTons: 1000,
        allowedCrops: ['All Commodities + Export Quality'],
        analyticsAccess: true,
        storageAccess: true,
        demandAlerts: true,
        priorityMatching: true,
        supplyForecastingAccess: true,
        badge: 'Enterprise',
        description: 'High volume institutional aggregator networks, FPOs and processing suppliers.'
      }
    ],

    offers: [
      {
        id: 'off-701',
        requirementId: 'req-201',
        listingId: 'list-101',
        buyerId: 'usr-buyer-1',
        buyerName: 'FreshBites Foods Pvt Ltd',
        sellerId: 'usr-farmer-1',
        sellerName: 'Ramesh Kumar',
        sellerRole: 'farmer',
        cropName: 'Potato',
        variety: 'Kufri Jyoti',
        quantityTons: 15,
        buyerOfferedPricePerKg: 21.0,
        farmerExpectedPricePerKg: 18.5,
        status: 'ACCEPTED',
        deliveryTerms: 'Pickup by Buyer/Aggregator at Farm Gate',
        createdAt: '2026-09-22T11:00:00Z',
        message: 'We accept your Grade A Kufri Jyoti listing for our upcoming batch delivery.'
      },
      {
        id: 'off-702',
        requirementId: 'req-202',
        listingId: 'list-104',
        buyerId: 'usr-buyer-2',
        buyerName: 'Apex Wholesale Agri Trade',
        sellerId: 'usr-farmer-3',
        sellerName: 'Mahendra Yadav',
        sellerRole: 'farmer',
        cropName: 'Potato',
        variety: 'Kufri Bahar',
        quantityTons: 20,
        buyerOfferedPricePerKg: 22.0,
        farmerExpectedPricePerKg: 18.2,
        status: 'PENDING',
        deliveryTerms: 'Consolidated Aggregator Delivery to Delhi Azadpur',
        createdAt: '2026-09-24T09:15:00Z',
        message: 'Looking to incorporate your 20T into our weekend wholesale dispatch.'
      }
    ],

    orders: [
      {
        id: 'ord-801',
        orderNumber: 'KC-2026-0982',
        buyerId: 'usr-buyer-1',
        buyerName: 'FreshBites Foods Pvt Ltd',
        sellerType: 'AGGREGATOR',
        sellerId: 'usr-agg-1',
        sellerName: 'Vikram Singh (Agra Agro Aggregations)',
        cropName: 'Potato',
        variety: 'Kufri Jyoti',
        quantityTons: 50,
        unitPricePerKg: 21.0,
        produceTotal: 1050000,
        logisticsCost: 42500,
        platformFee: 7500,
        totalAmount: 1100000,
        pickupLocation: 'Agra Bypass Hub (Consolidated from 4 farmers)',
        deliveryLocation: 'FreshBites Industrial Processing Center, Okhla, New Delhi',
        transporterId: 'trp-601',
        transporterName: 'Kisan Express Agri Freight',
        status: 'AGGREGATING',
        paymentStatus: 'ESCROW_LOCKED',
        createdAt: '2026-09-23T16:00:00Z',
        estimatedDeliveryDate: '2026-10-06',
        timeline: [
          { status: 'CREATED', note: 'Order created from Buyer Requirement fulfillment', timestamp: '2026-09-23T16:00:00Z' },
          { status: 'CONFIRMED', note: 'Aggregator accepted terms and locked farmer commitments', timestamp: '2026-09-23T16:30:00Z' },
          { status: 'AGGREGATING', note: 'Farmer collections scheduled across Agra & Mathura belt', timestamp: '2026-09-24T08:00:00Z' }
        ]
      },
      {
        id: 'ord-802',
        orderNumber: 'KC-2026-0814',
        buyerId: 'usr-buyer-2',
        buyerName: 'Apex Wholesale Agri Trade',
        sellerType: 'FARMER',
        sellerId: 'usr-farmer-1',
        sellerName: 'Ramesh Kumar',
        cropName: 'Potato',
        variety: 'Kufri Jyoti',
        quantityTons: 10,
        unitPricePerKg: 19.5,
        produceTotal: 195000,
        logisticsCost: 9500,
        platformFee: 2000,
        totalAmount: 206500,
        pickupLocation: 'Khandauli Village, Agra',
        deliveryLocation: 'Azadpur Mandi, Delhi',
        transporterId: 'trp-601',
        transporterName: 'Kisan Express Agri Freight',
        status: 'COMPLETED',
        paymentStatus: 'RELEASED_TO_SELLER',
        createdAt: '2026-09-12T10:00:00Z',
        estimatedDeliveryDate: '2026-09-14',
        timeline: [
          { status: 'CREATED', note: 'Direct farmer purchase agreed', timestamp: '2026-09-12T10:00:00Z' },
          { status: 'CONFIRMED', note: 'Payment placed in secure escrow', timestamp: '2026-09-12T10:30:00Z' },
          { status: 'READY_FOR_PICKUP', note: 'Graded bags ready at farm gate', timestamp: '2026-09-13T06:00:00Z' },
          { status: 'IN_TRANSIT', note: 'Vehicle UP 80 BT 4421 dispatched', timestamp: '2026-09-13T09:00:00Z' },
          { status: 'DELIVERED', note: 'Quality verified at Azadpur gate', timestamp: '2026-09-13T18:00:00Z' },
          { status: 'COMPLETED', note: 'Payment released to Ramesh Kumar bank account', timestamp: '2026-09-14T11:00:00Z' }
        ]
      }
    ],

    marketPrices: [
      {
        id: 'mp-01',
        cropName: 'Potato',
        variety: 'Kufri Jyoti',
        mandi: 'Agra APMC Mandi',
        district: 'Agra',
        state: 'Uttar Pradesh',
        date: '2026-09-24',
        minPrice: 16.5,
        maxPrice: 20.0,
        modalPrice: 18.25,
        trend: 'UP',
        volumeTonsToday: 1850,
        source: 'AGMARKNET / Agra Mandi Committee'
      },
      {
        id: 'mp-02',
        cropName: 'Potato',
        variety: 'Kufri Chipsona',
        mandi: 'Firozabad Mandi',
        district: 'Firozabad',
        state: 'Uttar Pradesh',
        date: '2026-09-24',
        minPrice: 18.0,
        maxPrice: 22.5,
        modalPrice: 20.5,
        trend: 'UP',
        volumeTonsToday: 940,
        source: 'AGMARKNET'
      },
      {
        id: 'mp-03',
        cropName: 'Potato',
        variety: 'Kufri Bahar',
        mandi: 'Mathura APMC',
        district: 'Mathura',
        state: 'Uttar Pradesh',
        date: '2026-09-24',
        minPrice: 16.0,
        maxPrice: 19.5,
        modalPrice: 17.8,
        trend: 'STABLE',
        volumeTonsToday: 1200,
        source: 'AGMARKNET'
      },
      {
        id: 'mp-04',
        cropName: 'Onion',
        variety: 'Nashik Red',
        mandi: 'Azadpur Mandi',
        district: 'Delhi',
        state: 'Delhi',
        date: '2026-09-24',
        minPrice: 24.0,
        maxPrice: 32.0,
        modalPrice: 28.5,
        trend: 'UP',
        volumeTonsToday: 3200,
        source: 'APMC Azadpur'
      },
      {
        id: 'mp-05',
        cropName: 'Tomato',
        variety: 'Himsona Hybrid',
        mandi: 'Kanpur Mandi',
        district: 'Kanpur',
        state: 'Uttar Pradesh',
        date: '2026-09-24',
        minPrice: 20.0,
        maxPrice: 28.0,
        modalPrice: 24.0,
        trend: 'DOWN',
        volumeTonsToday: 620,
        source: 'AGMARKNET'
      },
      {
        id: 'mp-06',
        cropName: 'Wheat',
        variety: 'Sharbati Premium',
        mandi: 'Lucknow Mandi',
        district: 'Lucknow',
        state: 'Uttar Pradesh',
        date: '2026-09-24',
        minPrice: 25.5,
        maxPrice: 30.0,
        modalPrice: 27.8,
        trend: 'STABLE',
        volumeTonsToday: 2100,
        source: 'AGMARKNET'
      }
    ],

    regionalSupplyForecasts: [
      {
        region: 'Agra District',
        crop: 'Potato',
        estimatedSupplyTons: 25000,
        estimatedDemandTons: 20000,
        potentialBalance: 5000,
        balanceType: 'SURPLUS',
        harvestWindow: 'Oct 15 - Nov 30',
        confidenceScore: '88% High (Based on 1,420 registered farmers & satellite vegetative index)',
        coldStorageBufferTons: 6200,
        recommendation: 'Surplus expected. Local aggregators recommended to book cold storage spaces early and route surplus toward Delhi-NCR processors.'
      },
      {
        region: 'Firozabad District',
        crop: 'Potato',
        estimatedSupplyTons: 12000,
        estimatedDemandTons: 13500,
        potentialBalance: -1500,
        balanceType: 'DEFICIT',
        harvestWindow: 'Oct 20 - Dec 10',
        confidenceScore: '82% Moderate',
        coldStorageBufferTons: 3100,
        recommendation: 'Deficit projected due to late sowing. Prices expected to remain firm. Good direct sale window for farmers.'
      },
      {
        region: 'Mathura District',
        crop: 'Potato',
        estimatedSupplyTons: 18500,
        estimatedDemandTons: 16000,
        potentialBalance: 2500,
        balanceType: 'SURPLUS',
        harvestWindow: 'Oct 10 - Nov 20',
        confidenceScore: '85% High',
        coldStorageBufferTons: 4500,
        recommendation: 'Steady supply. FPO aggregation clusters can supply bulk requirements to North Indian potato chips processors.'
      },
      {
        region: 'Kanpur Cluster',
        crop: 'Tomato',
        estimatedSupplyTons: 6500,
        estimatedDemandTons: 8200,
        potentialBalance: -1700,
        balanceType: 'DEFICIT',
        harvestWindow: 'Sep 25 - Oct 25',
        confidenceScore: '79% Moderate',
        coldStorageBufferTons: 400,
        recommendation: 'High price realizations possible. Encourage fast direct farm-gate matching with daily retail buyers.'
      }
    ],

    notifications: [
      {
        id: 'notif-01',
        userId: 'usr-farmer-1',
        title: 'New High-Score Buyer Match',
        message: 'FreshBites Foods posted a requirement for 60T Potato (Grade A) at ₹21.00/kg. Match Score: 92%.',
        type: 'MATCH',
        read: false,
        timestamp: '2026-09-24T14:00:00Z'
      },
      {
        id: 'notif-02',
        userId: 'usr-agg-1',
        title: 'Batch Milestone: 78% Reached',
        message: 'Batch #301 for FreshBites Foods now has 47T of 60T committed by 3 local farmers.',
        type: 'BATCH',
        read: false,
        timestamp: '2026-09-24T12:30:00Z'
      },
      {
        id: 'notif-03',
        userId: 'usr-buyer-1',
        title: 'Aggregator Batch Ready Soon',
        message: 'Vikram Singh has assembled 47T toward your 60T Potato requirement with estimated delivery on Oct 6.',
        type: 'ORDER',
        read: true,
        timestamp: '2026-09-24T13:00:00Z'
      },
      {
        id: 'notif-04',
        userId: 'usr-storage-1',
        title: 'Cold Storage Capacity Alert',
        message: 'Shamshabad Facility reached 75% capacity. 2,500T remains open for late potato bookings.',
        type: 'STORAGE',
        read: false,
        timestamp: '2026-09-24T08:00:00Z'
      }
    ],

    reviews: [
      {
        id: 'rev-01',
        targetUserId: 'usr-farmer-1',
        reviewerId: 'usr-buyer-1',
        reviewerName: 'FreshBites Foods Pvt Ltd',
        reviewerRole: 'Buyer',
        orderId: 'ord-802',
        rating: 5,
        comment: 'Superb quality Kufri Jyoti potatoes. Uniform 50-70mm grading with zero rot upon factory gate arrival.',
        date: '2026-09-15'
      },
      {
        id: 'rev-02',
        targetUserId: 'usr-agg-1',
        reviewerId: 'usr-farmer-1',
        reviewerName: 'Ramesh Kumar (Farmer)',
        reviewerRole: 'Farmer',
        orderId: 'ord-801',
        rating: 5,
        comment: 'Vikram bhai collected from farm gate on time and paid the agreed price without unnecessary cuts.',
        date: '2026-09-20'
      }
    ]
  };
}

class Database {
  constructor() {
    this.init();
  }

  init() {
    if (!fs.existsSync(DB_FILE)) {
      const initial = getInitialData();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      this.data = initial;
      console.log('[DB] Initialized fresh database with realistic agricultural seed data.');
    } else {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        console.log('[DB] Loaded existing persistent database.');
      } catch (err) {
        console.error('[DB] Error parsing DB file, recreating initial data:', err.message);
        const initial = getInitialData();
        fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
        this.data = initial;
      }
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] Error saving DB:', err);
    }
  }

  getCollection(name) {
    if (!this.data[name]) {
      this.data[name] = [];
      this.save();
    }
    return this.data[name];
  }

  find(collection, filterFn) {
    const list = this.getCollection(collection);
    if (!filterFn) return list;
    return list.filter(filterFn);
  }

  findOne(collection, filterFn) {
    const list = this.getCollection(collection);
    return list.find(filterFn) || null;
  }

  findById(collection, id) {
    const list = this.getCollection(collection);
    return list.find(item => item.id === id) || null;
  }

  insert(collection, doc) {
    const list = this.getCollection(collection);
    if (!doc.id) {
      doc.id = `${collection.slice(0, 3)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
    if (!doc.createdAt) {
      doc.createdAt = new Date().toISOString();
    }
    list.unshift(doc);
    this.save();
    return doc;
  }

  updateById(collection, id, updates) {
    const list = this.getCollection(collection);
    const index = list.findIndex(item => item.id === id);
    if (index === -1) return null;
    list[index] = { ...list[index], ...updates, updatedAt: new Date().toISOString() };
    this.save();
    return list[index];
  }

  deleteById(collection, id) {
    const list = this.getCollection(collection);
    const index = list.findIndex(item => item.id === id);
    if (index === -1) return false;
    list.splice(index, 1);
    this.save();
    return true;
  }

  reset() {
    const initial = getInitialData();
    this.data = initial;
    this.save();
    return initial;
  }
}

const db = new Database();
module.exports = { db, hashPassword };
