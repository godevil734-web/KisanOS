// backend/services/auditService.js
const { pool } = require('../db');
const crypto = require('crypto');

async function logAudit({ adminId, action, targetUserId = null, details = {} }) {
  if (!adminId || !action) return null;
  try {
    const id = `aud-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    await pool.query(`
      INSERT INTO audit_log (id, admin_id, action, target_user_id, details, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [id, adminId, action, targetUserId, JSON.stringify(details || {})]);
    return id;
  } catch (err) {
    console.error('[AUDIT_LOG] Failed to write audit log entry:', err.message);
    return null;
  }
}

module.exports = { logAudit };
