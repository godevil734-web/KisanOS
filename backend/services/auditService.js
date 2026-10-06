// backend/services/auditService.js
const { pool } = require('../db');
const crypto = require('crypto');

async function logAudit({ adminId = null, actorId = null, actorRole = null, action, targetUserId = null, details = {} }) {
  if (!action) return null;
  const effectiveActorId = actorId || adminId;
  try {
    const id = `aud-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    await pool.query(`
      INSERT INTO audit_log (id, admin_id, actor_id, actor_role, action, target_user_id, details, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [id, adminId || null, effectiveActorId || null, actorRole || null, action, targetUserId, JSON.stringify(details || {})]);
    return id;
  } catch (err) {
    console.error('[AUDIT_LOG] Failed to write audit log entry:', err.message);
    return null;
  }
}

module.exports = { logAudit };
