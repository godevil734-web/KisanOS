// backend/services/farmerProfileService.js
// Complete Farmer Digital Profile, Multi-Field Management & Crop Records
const { pool, mapRow } = require('../db');
const { awardPoints, getPointsBalance, calculateFarmerTrust } = require('./kisanPointsService');

/**
 * Calculate dynamic Profile Completion Percentage
 */
function calculateProfileCompletion(user, fieldsCount = 0, cropsCount = 0) {
  let score = 0;
  const checks = [
    { name: 'name', weight: 15, met: Boolean(user.name && user.name.trim().length >= 2) },
    { name: 'phone', weight: 15, met: Boolean(user.phone && user.phone.trim().length >= 10) },
    { name: 'email', weight: 10, met: Boolean(user.email && user.email.includes('@')) },
    { name: 'village', weight: 10, met: Boolean(user.village && user.village.trim().length > 0) },
    { name: 'district', weight: 10, met: Boolean(user.district || (user.location && user.location.trim().length > 0)) },
    { name: 'state', weight: 10, met: Boolean(user.state && user.state.trim().length > 0) },
    { name: 'avatar', weight: 10, met: Boolean(user.avatarUrl && user.avatarUrl.trim().length > 0) },
    { name: 'fields', weight: 10, met: fieldsCount > 0 },
    { name: 'crops', weight: 10, met: cropsCount > 0 }
  ];

  for (const c of checks) {
    if (c.met) score += c.weight;
  }

  const isEligibleForCompletionPoints = 
    checks.find(c => c.name === 'name').met &&
    checks.find(c => c.name === 'phone').met &&
    checks.find(c => c.name === 'village').met &&
    score >= 70;

  return {
    percentage: Math.min(score, 100),
    checks,
    isEligibleForCompletionPoints
  };
}

/**
 * Retrieve comprehensive Farmer Digital Profile
 */
async function getFarmerProfile(userId) {
  if (!userId) {
    throw new Error('User ID is required to fetch farmer profile.');
  }

  // 1. Fetch user record
  const userRes = await pool.query(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [userId]);
  if (userRes.rows.length === 0) {
    throw new Error('User account not found.');
  }
  const user = mapRow(userRes.rows[0]);

  // 2. Fetch farmer fields
  const fieldsRes = await pool.query(`
    SELECT * FROM farmer_fields 
    WHERE farmer_id = $1 
    ORDER BY created_at DESC
  `, [userId]);
  const fields = fieldsRes.rows.map(mapRow);

  // 3. Fetch crop records
  const cropsRes = await pool.query(`
    SELECT cr.*, ff.name as field_name, ff.area_acres as field_acres
    FROM farmer_crop_records cr
    LEFT JOIN farmer_fields ff ON cr.field_id = ff.id
    WHERE cr.farmer_id = $1
    ORDER BY cr.created_at DESC
  `, [userId]);
  const cropRecords = cropsRes.rows.map(mapRow);

  // 4. Compute land and crop analytics
  const totalCultivatedAcres = fields.reduce((sum, f) => sum + (Number(f.areaAcres) || 0), 0);
  const activeCropsCount = cropRecords.filter(c => c.status === 'Growing' || c.status === 'Ready to Harvest' || c.status === 'Planned').length;
  const totalHarvestedTons = cropRecords.reduce((sum, c) => sum + (Number(c.actualHarvestedQuantity) || 0), 0);
  const totalAvailableForSaleTons = cropRecords.reduce((sum, c) => sum + (Number(c.quantityForSale) || 0), 0);

  // 5. Fetch sales & transaction history from orders table
  const salesRes = await pool.query(`
    SELECT * FROM orders 
    WHERE seller_id = $1 
    ORDER BY created_at DESC
  `, [userId]);
  const allOrders = salesRes.rows.map(mapRow);
  const completedOrders = allOrders.filter(o => o.status === 'COMPLETED');
  const totalCompletedSales = completedOrders.length;
  const totalVerifiedQuantitySoldTons = completedOrders.reduce((sum, o) => sum + (Number(o.quantityTons) || 0), 0);
  const totalSalesRevenue = completedOrders.reduce((sum, o) => sum + (Number(o.produceTotal || o.totalAmount) || 0), 0);

  // 6. Fetch Kisan Points balance & Trust metrics
  const pointsBalance = await getPointsBalance(userId);
  const trustMetrics = await calculateFarmerTrust(userId);

  // 7. Profile completion calculation
  const completion = calculateProfileCompletion(user, fields.length, cropRecords.length);

  // Safe user profile view (removes passwords, tokens, hashes)
  const safeProfile = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatarUrl: user.avatarUrl || null,
    village: user.village || user.farmerProfile?.village || '',
    district: user.district || user.farmerProfile?.district || (user.location ? user.location.split(',')[0].trim() : ''),
    state: user.state || user.farmerProfile?.state || (user.location ? (user.location.split(',')[1] || '').trim() : ''),
    preferredLanguage: user.preferredLanguage || 'hi',
    farmLocation: user.farmerProfile?.farmLocation || user.location || `${user.village ? user.village + ', ' : ''}${user.district || 'Agra'}, ${user.state || 'Uttar Pradesh'}`,
    coordinates: user.farmerProfile?.coordinates || null,
    mainCrops: user.farmerProfile?.mainCrops || user.mainCrops || [],
    status: user.status,
    verified: Boolean(user.verified),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    // Aggregated Metrics
    metrics: {
      totalCultivatedAcres: Number(totalCultivatedAcres.toFixed(2)),
      registeredFieldsCount: fields.length,
      activeCropsCount,
      totalCropRecordsCount: cropRecords.length,
      totalHarvestedTons: Number(totalHarvestedTons.toFixed(2)),
      totalAvailableForSaleTons: Number(totalAvailableForSaleTons.toFixed(2)),
      totalCompletedSales,
      totalVerifiedQuantitySoldTons: Number(totalVerifiedQuantitySoldTons.toFixed(2)),
      totalSalesRevenue: Number(totalSalesRevenue.toFixed(2)),
      kisanPointsBalance: pointsBalance
    },
    completion,
    trust: trustMetrics,
    fields,
    cropRecords,
    recentSales: completedOrders.slice(0, 10)
  };

  return safeProfile;
}

/**
 * Update Farmer Profile personal & farm details
 */
async function updateFarmerProfile(userId, updates = {}) {
  if (!userId) throw new Error('User ID is required.');

  const { name, village, district, state, avatarUrl, preferredLanguage, bio, farmLocation, latitude, longitude, coordinates, mainCrops } = updates;

  // Build clean location string if village/district/state provided
  const locationParts = [village, district, state].filter(Boolean);
  const locationStr = locationParts.length > 0 ? locationParts.join(', ') : (farmLocation || undefined);

  const userRes = await pool.query(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [userId]);
  if (userRes.rows.length === 0) throw new Error('User account not found.');
  const existingUser = mapRow(userRes.rows[0]);

  const existingProfile = existingUser.farmerProfile || {};
  const resolvedCoordinates = (latitude !== undefined && longitude !== undefined)
    ? { lat: Number(latitude), lon: Number(longitude) }
    : (coordinates !== undefined ? coordinates : existingProfile.coordinates);

  const updatedFarmerProfile = {
    ...existingProfile,
    village: village !== undefined ? village : existingProfile.village,
    district: district !== undefined ? district : existingProfile.district,
    state: state !== undefined ? state : existingProfile.state,
    bio: bio !== undefined ? bio : existingProfile.bio,
    farmLocation: farmLocation !== undefined ? farmLocation : (locationStr || existingProfile.farmLocation),
    coordinates: resolvedCoordinates,
    mainCrops: Array.isArray(mainCrops) ? mainCrops : existingProfile.mainCrops
  };

  const updateFields = [];
  const updateValues = [];
  let idx = 1;

  if (name !== undefined) {
    updateFields.push(`name = $${idx++}`);
    updateValues.push(name.trim());
  }
  if (village !== undefined) {
    updateFields.push(`village = $${idx++}`);
    updateValues.push(village.trim());
  }
  if (district !== undefined) {
    updateFields.push(`district = $${idx++}`);
    updateValues.push(district.trim());
  }
  if (state !== undefined) {
    updateFields.push(`state = $${idx++}`);
    updateValues.push(state.trim());
  }
  if (locationStr !== undefined) {
    updateFields.push(`location = $${idx++}`);
    updateValues.push(locationStr);
  }
  if (avatarUrl !== undefined) {
    updateFields.push(`avatar_url = $${idx++}`);
    updateValues.push(avatarUrl);
  }
  if (preferredLanguage !== undefined) {
    updateFields.push(`preferred_language = $${idx++}`);
    updateValues.push(preferredLanguage);
  }

  updateFields.push(`farmer_profile = $${idx++}`);
  updateValues.push(JSON.stringify(updatedFarmerProfile));

  updateFields.push(`updated_at = NOW()`);
  updateValues.push(userId);

  const query = `
    UPDATE users 
    SET ${updateFields.join(', ')} 
    WHERE id = $${idx} 
    RETURNING *
  `;

  const updatedRes = await pool.query(query, updateValues);
  const updatedUser = mapRow(updatedRes.rows[0]);

  // Check if profile is now complete to award PROFILE_COMPLETED points
  const fieldsRes = await pool.query(`SELECT COUNT(*)::int as cnt FROM farmer_fields WHERE farmer_id = $1`, [userId]);
  const fieldsCount = fieldsRes.rows[0]?.cnt || 0;
  const cropsRes = await pool.query(`SELECT COUNT(*)::int as cnt FROM farmer_crop_records WHERE farmer_id = $1`, [userId]);
  const cropsCount = cropsRes.rows[0]?.cnt || 0;

  const comp = calculateProfileCompletion(updatedUser, fieldsCount, cropsCount);
  if (comp.isEligibleForCompletionPoints) {
    await awardPoints(
      userId, 
      'PROFILE_COMPLETED', 
      userId, 
      'Awarded for complete digital profile registration'
    );
  }

  return getFarmerProfile(userId);
}

// -------------------------------------------------------------
// MY FIELDS MANAGEMENT
// -------------------------------------------------------------

async function getFarmerFields(farmerId) {
  if (!farmerId) return [];
  const res = await pool.query(`
    SELECT * FROM farmer_fields 
    WHERE farmer_id = $1 
    ORDER BY created_at DESC
  `, [farmerId]);
  return res.rows.map(mapRow);
}

async function addFarmerField(farmerId, fieldData) {
  if (!farmerId) throw new Error('Farmer ID is required.');
  const { 
    name, 
    areaAcres, 
    village, 
    district, 
    state, 
    ownershipStatus = 'owned', 
    irrigationSource = 'borewell', 
    soilType = 'alluvial',
    latitude = null, 
    longitude = null 
  } = fieldData;

  if (!name || !name.trim()) throw new Error('Field name is required.');
  const acres = Number(areaAcres);
  if (isNaN(acres) || acres <= 0) throw new Error('Valid area in acres greater than 0 is required.');
  if (!village || !village.trim()) throw new Error('Village is required.');
  if (!district || !district.trim()) throw new Error('District is required.');
  if (!state || !state.trim()) throw new Error('State is required.');

  // Prevent duplicate field names for the same farmer
  const dupCheck = await pool.query(`
    SELECT id FROM farmer_fields 
    WHERE farmer_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))
    LIMIT 1
  `, [farmerId, name.trim()]);
  if (dupCheck.rows.length > 0) {
    throw new Error(`A field named "${name.trim()}" already exists in your records.`);
  }

  const id = `fld-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const res = await pool.query(`
    INSERT INTO farmer_fields (
      id, farmer_id, name, area_acres, village, district, state, 
      ownership_status, irrigation_source, soil_type, latitude, longitude, 
      verification_status, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, 
      $8, $9, $10, $11, $12, 
      'self_declared', NOW(), NOW()
    ) RETURNING *
  `, [
    id, farmerId, name.trim(), acres, village.trim(), district.trim(), state.trim(),
    ownershipStatus, irrigationSource, soilType, latitude, longitude
  ]);

  const newField = mapRow(res.rows[0]);

  // Award Kisan Points for registering field (Idempotent per field ID)
  await awardPoints(
    farmerId, 
    'FIELD_ADDED', 
    newField.id, 
    `Registered field "${newField.name}" (${newField.areaAcres} acres)`
  );

  return newField;
}

async function updateFarmerField(farmerId, fieldId, updates) {
  if (!farmerId || !fieldId) throw new Error('Farmer ID and Field ID are required.');

  const existingRes = await pool.query(`
    SELECT * FROM farmer_fields WHERE id = $1 AND farmer_id = $2 LIMIT 1
  `, [fieldId, farmerId]);

  if (existingRes.rows.length === 0) {
    throw new Error('Field not found or unauthorized access.');
  }

  const { 
    name, 
    areaAcres, 
    village, 
    district, 
    state, 
    ownershipStatus, 
    irrigationSource, 
    soilType, 
    latitude, 
    longitude 
  } = updates;

  const setClauses = [];
  const values = [];
  let idx = 1;

  if (name !== undefined) {
    if (!name.trim()) throw new Error('Field name cannot be empty.');
    // Check duplicate name excluding this field
    const dupCheck = await pool.query(`
      SELECT id FROM farmer_fields 
      WHERE farmer_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) AND id != $3
      LIMIT 1
    `, [farmerId, name.trim(), fieldId]);
    if (dupCheck.rows.length > 0) {
      throw new Error(`Another field named "${name.trim()}" already exists.`);
    }
    setClauses.push(`name = $${idx++}`);
    values.push(name.trim());
  }

  if (areaAcres !== undefined) {
    const acres = Number(areaAcres);
    if (isNaN(acres) || acres <= 0) throw new Error('Valid area in acres is required.');
    setClauses.push(`area_acres = $${idx++}`);
    values.push(acres);
  }

  if (village !== undefined) {
    setClauses.push(`village = $${idx++}`);
    values.push(village.trim());
  }

  if (district !== undefined) {
    setClauses.push(`district = $${idx++}`);
    values.push(district.trim());
  }

  if (state !== undefined) {
    setClauses.push(`state = $${idx++}`);
    values.push(state.trim());
  }

  if (ownershipStatus !== undefined) {
    setClauses.push(`ownership_status = $${idx++}`);
    values.push(ownershipStatus);
  }

  if (irrigationSource !== undefined) {
    setClauses.push(`irrigation_source = $${idx++}`);
    values.push(irrigationSource);
  }

  if (soilType !== undefined) {
    setClauses.push(`soil_type = $${idx++}`);
    values.push(soilType);
  }

  if (latitude !== undefined) {
    setClauses.push(`latitude = $${idx++}`);
    values.push(latitude);
  }

  if (longitude !== undefined) {
    setClauses.push(`longitude = $${idx++}`);
    values.push(longitude);
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(fieldId);
  values.push(farmerId);

  const query = `
    UPDATE farmer_fields 
    SET ${setClauses.join(', ')} 
    WHERE id = $${idx++} AND farmer_id = $${idx++} 
    RETURNING *
  `;

  const updatedRes = await pool.query(query, values);
  return mapRow(updatedRes.rows[0]);
}

async function deleteFarmerField(farmerId, fieldId) {
  if (!farmerId || !fieldId) throw new Error('Farmer ID and Field ID are required.');

  const existingRes = await pool.query(`
    SELECT * FROM farmer_fields WHERE id = $1 AND farmer_id = $2 LIMIT 1
  `, [fieldId, farmerId]);

  if (existingRes.rows.length === 0) {
    throw new Error('Field not found or unauthorized access.');
  }

  // Nullify field_id on any associated crop records
  await pool.query(`UPDATE farmer_crop_records SET field_id = NULL WHERE field_id = $1`, [fieldId]);
  await pool.query(`DELETE FROM farmer_fields WHERE id = $1 AND farmer_id = $2`, [fieldId, farmerId]);

  return { success: true, deletedId: fieldId };
}

// -------------------------------------------------------------
// MY CROP RECORDS MANAGEMENT
// -------------------------------------------------------------

async function getFarmerCropRecords(farmerId) {
  if (!farmerId) return [];
  const res = await pool.query(`
    SELECT cr.*, ff.name as field_name, ff.area_acres as field_acres
    FROM farmer_crop_records cr
    LEFT JOIN farmer_fields ff ON cr.field_id = ff.id
    WHERE cr.farmer_id = $1
    ORDER BY cr.created_at DESC
  `, [farmerId]);
  return res.rows.map(mapRow);
}

async function addFarmerCropRecord(farmerId, recordData) {
  if (!farmerId) throw new Error('Farmer ID is required.');
  const {
    fieldId = null,
    cropName,
    variety = '',
    season = 'Kharif',
    sowingDate = null,
    expectedHarvestDate = null,
    estimatedYield = 0,
    yieldUnit = 'Quintals',
    actualHarvestedQuantity = 0,
    quantityForSale = 0,
    status = 'Growing',
    notes = ''
  } = recordData;

  if (!cropName || !cropName.trim()) throw new Error('Crop name is required.');

  // Validate associated field if specified
  if (fieldId) {
    const fldCheck = await pool.query(`
      SELECT id FROM farmer_fields WHERE id = $1 AND farmer_id = $2 LIMIT 1
    `, [fieldId, farmerId]);
    if (fldCheck.rows.length === 0) {
      throw new Error('The selected field does not exist in your account.');
    }
  }

  const estYield = Number(estimatedYield) || 0;
  const actualQty = Number(actualHarvestedQuantity) || 0;
  const saleQty = Number(quantityForSale) || 0;

  const id = `crp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const res = await pool.query(`
    INSERT INTO farmer_crop_records (
      id, farmer_id, field_id, crop_name, variety, season,
      sowing_date, expected_harvest_date, estimated_yield, yield_unit,
      actual_harvested_quantity, quantity_for_sale, status, notes,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10,
      $11, $12, $13, $14,
      NOW(), NOW()
    ) RETURNING *
  `, [
    id, farmerId, fieldId, cropName.trim(), variety.trim(), season,
    sowingDate || null, expectedHarvestDate || null, estYield, yieldUnit,
    actualQty, saleQty, status, notes
  ]);

  const newRecord = mapRow(res.rows[0]);

  // Award Kisan Points for complete crop record (Idempotent)
  await awardPoints(
    farmerId,
    'CROP_RECORD_ADDED',
    newRecord.id,
    `Logged crop record "${newRecord.cropName}" (${newRecord.season} season)`
  );

  return newRecord;
}

async function updateFarmerCropRecord(farmerId, recordId, updates) {
  if (!farmerId || !recordId) throw new Error('Farmer ID and Record ID are required.');

  const existingRes = await pool.query(`
    SELECT * FROM farmer_crop_records WHERE id = $1 AND farmer_id = $2 LIMIT 1
  `, [recordId, farmerId]);

  if (existingRes.rows.length === 0) {
    throw new Error('Crop record not found or unauthorized access.');
  }

  const {
    fieldId,
    cropName,
    variety,
    season,
    sowingDate,
    expectedHarvestDate,
    estimatedYield,
    yieldUnit,
    actualHarvestedQuantity,
    quantityForSale,
    status,
    notes
  } = updates;

  const setClauses = [];
  const values = [];
  let idx = 1;

  if (fieldId !== undefined) {
    if (fieldId) {
      const fldCheck = await pool.query(`
        SELECT id FROM farmer_fields WHERE id = $1 AND farmer_id = $2 LIMIT 1
      `, [fieldId, farmerId]);
      if (fldCheck.rows.length === 0) {
        throw new Error('Selected field not found.');
      }
    }
    setClauses.push(`field_id = $${idx++}`);
    values.push(fieldId || null);
  }

  if (cropName !== undefined) {
    if (!cropName.trim()) throw new Error('Crop name cannot be empty.');
    setClauses.push(`crop_name = $${idx++}`);
    values.push(cropName.trim());
  }

  if (variety !== undefined) {
    setClauses.push(`variety = $${idx++}`);
    values.push(variety.trim());
  }

  if (season !== undefined) {
    setClauses.push(`season = $${idx++}`);
    values.push(season);
  }

  if (sowingDate !== undefined) {
    setClauses.push(`sowing_date = $${idx++}`);
    values.push(sowingDate || null);
  }

  if (expectedHarvestDate !== undefined) {
    setClauses.push(`expected_harvest_date = $${idx++}`);
    values.push(expectedHarvestDate || null);
  }

  if (estimatedYield !== undefined) {
    setClauses.push(`estimated_yield = $${idx++}`);
    values.push(Number(estimatedYield) || 0);
  }

  if (yieldUnit !== undefined) {
    setClauses.push(`yield_unit = $${idx++}`);
    values.push(yieldUnit);
  }

  if (actualHarvestedQuantity !== undefined) {
    setClauses.push(`actual_harvested_quantity = $${idx++}`);
    values.push(Number(actualHarvestedQuantity) || 0);
  }

  if (quantityForSale !== undefined) {
    setClauses.push(`quantity_for_sale = $${idx++}`);
    values.push(Number(quantityForSale) || 0);
  }

  if (status !== undefined) {
    setClauses.push(`status = $${idx++}`);
    values.push(status);
  }

  if (notes !== undefined) {
    setClauses.push(`notes = $${idx++}`);
    values.push(notes);
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(recordId);
  values.push(farmerId);

  const query = `
    UPDATE farmer_crop_records
    SET ${setClauses.join(', ')}
    WHERE id = $${idx++} AND farmer_id = $${idx++}
    RETURNING *
  `;

  const updatedRes = await pool.query(query, values);
  return mapRow(updatedRes.rows[0]);
}

async function deleteFarmerCropRecord(farmerId, recordId) {
  if (!farmerId || !recordId) throw new Error('Farmer ID and Record ID are required.');

  const existingRes = await pool.query(`
    SELECT * FROM farmer_crop_records WHERE id = $1 AND farmer_id = $2 LIMIT 1
  `, [recordId, farmerId]);

  if (existingRes.rows.length === 0) {
    throw new Error('Crop record not found or unauthorized access.');
  }

  await pool.query(`DELETE FROM farmer_crop_records WHERE id = $1 AND farmer_id = $2`, [recordId, farmerId]);
  return { success: true, deletedId: recordId };
}

module.exports = {
  getFarmerProfile,
  updateFarmerProfile,
  getFarmerFields,
  addFarmerField,
  updateFarmerField,
  deleteFarmerField,
  getFarmerCropRecords,
  addFarmerCropRecord,
  updateFarmerCropRecord,
  deleteFarmerCropRecord
};
