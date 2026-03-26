/**
 * SAFE TRANSACTION WRAPPER
 * 
 * Provides production-grade transaction handling with:
 * - Automatic rollback on error
 * - Proper connection management
 * - Business logic separation (no throws inside transaction)
 * - Comprehensive error logging
 */

const { sequelize } = require('../config/unified_database');
const { enforceSchema, securityCheck } = require('../src/utils/schemaEnforcement');
const { TENANT_SCHEMA_PREFIX } = require('../src/utils/constants');
const tenantModelLoader = require('../src/architecture/tenantModelLoader');

/**
 * Execute database operations within a safe transaction
 * @param {Function} callback - Async function receiving (transaction, models)
 * @param {Object} options - Transaction options
 * @returns {Object} { success: boolean, data?: any, error?: string }
 */
async function withTransaction(callback, options = {}) {
  const transaction = await sequelize.transaction({
    isolationLevel: options.isolationLevel || 'READ COMMITTED',
    ...options
  });

  try {
    const result = await callback(transaction);
    
    // Only commit if no error object returned
    if (result && result.error) {
      await transaction.rollback();
      return result;
    }
    
    await transaction.commit();
    return { success: true, data: result };
  } catch (error) {
    // Always rollback on any error
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error('❌ Transaction rollback failed:', rollbackError.message);
    }
    
    console.error('❌ Transaction failed:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    return { 
      success: false, 
      error: error.message || 'Transaction failed'
    };
  }
}

/**
 * Execute with tenant context (using schema-bound models - NO search_path)
 * @param {string} tenantId - Tenant identifier
 * @param {Function} callback - Async function receiving (transaction, models, schemaName)
 * @param {Object} options - Transaction options
 */
async function withTenantTransaction(tenantId, callback, options = {}) {
  // 🔒 Validate schema before transaction
  const schemaName = `${TENANT_SCHEMA_PREFIX}${tenantId}`;
  enforceSchema(schemaName, tenantId);
  securityCheck(schemaName, tenantId, 'withTenantTransaction');
  
  // Get schema-bound models
  const models = await tenantModelLoader.getTenantModels(sequelize, schemaName);
  
  return withTransaction(async (transaction) => {
    // NO SET search_path - Using explicit schema-bound models instead
    return await callback(transaction, models, schemaName);
  }, options);
}

/**
 * Safe database query wrapper with logging
 */
async function safeQuery(model, operation, options = {}) {
  try {
    const start = Date.now();
    const result = await model[operation](options);
    const duration = Date.now() - start;
    
    if (duration > 1000) {
      console.warn(`⚠️ Slow query detected: ${operation} took ${duration}ms`);
    }
    
    return { success: true, data: result };
  } catch (error) {
    console.error('❌ Database query failed:', {
      operation,
      model: model.name,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    return { success: false, error: error.message };
  }
}

module.exports = {
  withTransaction,
  withTenantTransaction,
  safeQuery
};
