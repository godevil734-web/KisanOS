// backend/middleware/rateLimiter.js
const { pool } = require('../db');

/**
 * Database-backed rate limiter using a fixed-window counter in PostgreSQL.
 * Executes exactly ONE atomic INSERT ... ON CONFLICT (key) DO UPDATE statement per request.
 * Resets the window when expired, otherwise increments count.
 * Returns the new count in the same statement (RETURNING count, window_start).
 */
function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 10, message = 'Too many requests, please try again later.' }) {
  const effectiveMax = process.env.NODE_ENV === 'production' ? max : Math.max(max, 100);

  return async (req, res, next) => {
    const isAuthCritical = (req.baseUrl || '').includes('/auth') || 
                           (req.path || '').includes('/auth') || 
                           (req.path || '').includes('/login') || 
                           (req.path || '').includes('/otp/');

    try {
      if (!pool) {
        if (isAuthCritical) {
          return res.status(503).json({ error: 'Service Unavailable. Database not configured.' });
        }
        return next();
      }

      const ip = req.ip;
      const pathKey = (req.baseUrl || '') + (req.path || '');
      const key = `${ip}-${pathKey}`;

      // Single atomic query: resets window if expired, otherwise increments count
      let queryRes;
      try {
        queryRes = await pool.query(`
          INSERT INTO rate_limits (key, count, window_start)
          VALUES ($1, 1, NOW())
          ON CONFLICT (key) DO UPDATE SET
            count = CASE
              WHEN rate_limits.window_start < NOW() - ($2 || ' milliseconds')::interval THEN 1
              ELSE rate_limits.count + 1
            END,
            window_start = CASE
              WHEN rate_limits.window_start < NOW() - ($2 || ' milliseconds')::interval THEN NOW()
              ELSE rate_limits.window_start
            END
          RETURNING count, window_start;
        `, [key, windowMs]);
      } catch (poolErr) {
        if (poolErr.message && (poolErr.message.includes('timeout') || poolErr.message.includes('terminated') || poolErr.message.includes('closed'))) {
          // Retry once on transient pool timeout
          queryRes = await pool.query(`
            INSERT INTO rate_limits (key, count, window_start)
            VALUES ($1, 1, NOW())
            ON CONFLICT (key) DO UPDATE SET
              count = CASE
                WHEN rate_limits.window_start < NOW() - ($2 || ' milliseconds')::interval THEN 1
                ELSE rate_limits.count + 1
              END,
              window_start = CASE
                WHEN rate_limits.window_start < NOW() - ($2 || ' milliseconds')::interval THEN NOW()
                ELSE rate_limits.window_start
              END
            RETURNING count, window_start;
          `, [key, windowMs]);
        } else {
          throw poolErr;
        }
      }

      const currentCount = queryRes.rows[0].count;
      const windowStart = new Date(queryRes.rows[0].window_start).getTime();

      // Check limit
      if (currentCount > effectiveMax) {
        const elapsed = Date.now() - windowStart;
        const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
        return res.status(429).json({
          error: message,
          retryAfterSeconds
        });
      }

      // Cheap inline cleanup with 5% probability per request
      if (Math.random() < 0.05) {
        try {
          await pool.query("DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 hour'");
        } catch (cleanupErr) {
          // Ignore cleanup errors
        }
      }

      next();
    } catch (err) {
      console.warn('[RateLimiter] Database warning (failing open):', err.message);
      next();
    }
  };
}

module.exports = { createRateLimiter, pool };
