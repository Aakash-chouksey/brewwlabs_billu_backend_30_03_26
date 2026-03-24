/**
 * SEARCH PATH RESET MIDDLEWARE
 * 
 * PHASE 3: RESET SEARCH PATH AFTER EVERY REQUEST
 * Prevents:
 * - Login breaking after dashboard
 * - Cross-tenant leaks
 * - Random failures due to connection state pollution
 */

const { sequelize } = require('../config/unified_database');

/**
 * Middleware to reset search_path after request completes
 * CRITICAL: Prevents connection state pollution between requests
 */
const searchPathResetMiddleware = (req, res, next) => {
  // Store original end function
  const originalEnd = res.end;
  
  // Override res.end to reset search path after response is sent
  res.end = async function(...args) {
    try {
      // Reset search_path to public for next request
      // Use a fresh connection pool query to avoid affecting current transaction
      await sequelize.query('SET search_path TO public', { raw: true })
        .catch(err => {
          // Silently log but don't fail the response
          console.warn('⚠️ [PHASE 3] Search path reset failed:', err.message);
        });
      
      console.log(`🔧 [PHASE 3] Search path reset to public after ${req.method} ${req.path}`);
    } catch (error) {
      // Never fail the response due to cleanup
      console.error('❌ [PHASE 3] Search path reset error:', error.message);
    }
    
    // Call original end
    return originalEnd.apply(this, args);
  };
  
  // Also handle res.json for JSON responses
  const originalJson = res.json;
  res.json = async function(data) {
    try {
      // Reset search_path before sending JSON response
      await sequelize.query('SET search_path TO public', { raw: true })
        .catch(err => {
          console.warn('⚠️ [PHASE 3] Search path reset (json) failed:', err.message);
        });
    } catch (error) {
      console.error('❌ [PHASE 3] Search path reset (json) error:', error.message);
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

/**
 * Alternative: Connection cleanup middleware for connection pooling
 * Ensures each request starts with clean connection state
 */
const connectionCleanupMiddleware = async (req, res, next) => {
  try {
    // Ensure search_path starts as public for each new request
    await sequelize.query('SET search_path TO public', { raw: true });
    console.log(`🔧 [PHASE 3] Connection initialized with public search_path for ${req.method} ${req.path}`);
  } catch (error) {
    console.warn('⚠️ [PHASE 3] Initial search_path set failed:', error.message);
  }
  
  next();
};

module.exports = {
  searchPathResetMiddleware,
  connectionCleanupMiddleware
};
