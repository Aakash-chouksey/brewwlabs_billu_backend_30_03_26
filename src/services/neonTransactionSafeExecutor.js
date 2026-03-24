const Sequelize = require('sequelize');
const { CONTROL_PLANE, PUBLIC_SCHEMA, TENANT_SCHEMA_PREFIX } = require('../src/utils/constants');
const { ModelFactory } = require('../src/architecture/modelFactory');

// Lazy load database to prevent require-time connection
let sequelize;
const getSequelize = () => {
  if (!sequelize) {
    sequelize = require('../config/unified_database').sequelize;
  }
  return sequelize;
};

// PHASE 4 FIX: Model initialization cache - initialized once globally
let cachedModels = null;
let modelsInitializing = false;
let modelInitPromise = null;

// FIX 2: TENANT MODEL CACHE - Cache schema-bound models per tenant for massive performance gain
const tenantModelCache = new Map();
const TENANT_CACHE_MAX_SIZE = 100; // Prevent unbounded memory growth

/**
 * Clear tenant model cache (useful for testing or schema changes)
 */
function clearTenantModelCache(schemaName) {
  if (schemaName) {
    tenantModelCache.delete(schemaName);
  } else {
    tenantModelCache.clear();
  }
}

/**
 * Get cache statistics for monitoring
 */
function getTenantCacheStats() {
  return {
    size: tenantModelCache.size,
    maxSize: TENANT_CACHE_MAX_SIZE,
    keys: Array.from(tenantModelCache.keys())
  };
}

/**
 * Get cached models or initialize once
 */
async function getCachedModels(sequelize) {
    if (cachedModels) {
        return cachedModels;
    }
    
    if (modelsInitializing && modelInitPromise) {
        return await modelInitPromise;
    }
    
    modelsInitializing = true;
    modelInitPromise = ModelFactory.createModels(sequelize).then(models => {
        cachedModels = models;
        modelsInitializing = false;
        return models;
    });
    
    return await modelInitPromise;
}

/**
 * NEON-TRANSACTION-SAFE EXECUTION LAYER
 * 
 * CRITICAL RULES:
 * 1. If schema missing → THROW ERROR (no auto-create, no fallback)
 * 2. Auth/Public operations → use executeInPublic ONLY
 * 3. Tenant queries → search_path = "tenant_xxx" ONLY (no public)
 * 4. Models cached once globally (not per request)
 */
class NeonTransactionSafeExecutor {
    constructor() {
        this.activeTransactions = new Map();
        this.operationCounter = 0;
    }

    /**
     * Execute operation with tenant schema within transaction
     * STRICT RULES:
     * - Schema missing = THROW ERROR (no auto-create)
     * - No fallback to public
     * - search_path = tenant ONLY (no public)
     */
    async executeWithTenant(tenantId, operation, options = {}) {
        const operationId = `op_${++this.operationCounter}_${Date.now()}`;
        const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        let transaction = null;
        
        // CRITICAL: Check if this is an AUTH/PUBLIC_ONLY operation
        const isPublicOnly = options.publicOnly === true || options.operationType === 'AUTH';
        if (isPublicOnly) {
            return this.executeInPublic(operation, options);
        }
        
        try {
            // PHASE 4 FIX: Use cached models, don't reinitialize per request
            await getCachedModels(getSequelize());
            
            // 2. Start transaction with Neon-optimized settings
            transaction = await getSequelize().transaction({
                isolationLevel: options.isolationLevel || Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
                type: options.type || Sequelize.Transaction.TYPES.DEFERRED,
                deferrable: options.deferrable || null
            });

            // Track transaction for monitoring and cleanup
            this.activeTransactions.set(transactionId, {
                transaction,
                tenantId,
                operationId,
                startTime: Date.now(),
                operation: operation.name || 'anonymous'
            });

            // 3. STRICT: Check schema exists - NO AUTO-CREATE, NO FALLBACK
            const schemaName = (tenantId === CONTROL_PLANE || tenantId === 'health_check')
                ? PUBLIC_SCHEMA 
                : `${TENANT_SCHEMA_PREFIX}${tenantId}`;
            
            // Prevent SQL injection
            if (!/^[a-zA-Z0-9_\-]+$/.test(tenantId)) {
                throw new Error('🚨 Invalid tenant ID format detected. Aborting to prevent SQL injection.');
            }

            // STRICT CHECK: Schema must exist
            if (tenantId !== CONTROL_PLANE && tenantId !== 'health_check') {
                const schemaCheck = await getSequelize().query(
                    `SELECT schema_name FROM information_schema.schemata WHERE schema_name = :schemaName`,
                    {
                        replacements: { schemaName },
                        type: Sequelize.QueryTypes.SELECT,
                        transaction
                    }
                );
                
                if (!schemaCheck.length) {
                    // FAST FAIL: Return 503 instead of throwing generic error
                    const error = new Error(`Tenant schema missing: ${schemaName}`);
                    error.code = 'SCHEMA_MISSING';
                    error.statusCode = 503;
                    error.isOperational = true;
                    throw error;
                }
            }

            // 4. STRICT: Set search_path - TENANT ONLY (no public fallback)
            // FIX 5: Removed public from tenant search path
            const searchPath = (tenantId === CONTROL_PLANE || tenantId === 'health_check')
                ? `"${PUBLIC_SCHEMA}"`
                : `"${schemaName}"`;  // STRICT: tenant schema ONLY

            await getSequelize().query(
                `SET LOCAL search_path TO ${searchPath}`,
                { 
                    transaction,
                    type: Sequelize.QueryTypes.SET 
                }
            );

            // 5. Inject schema-bound models into transaction - USE CACHE IF AVAILABLE
            const tenantModels = {};
            const publicModels = [
                'User', 'Business', 'Auth', 'MembershipPlan', 'Plan', 
                'Subscription', 'TenantRegistry', 'AuditLog', 
                'SuperAdminUser', 'ClusterMetadata', 'TenantMigrationLog',
                'SystemMetrics', 'TenantConnection'
            ];
            
            // FIX 2: Use cached models or get from sequelize
            const cacheKey = schemaName;
            let cachedSchemaModels = tenantModelCache.get(cacheKey);
            
            if (!cachedSchemaModels) {
                // Build models for this schema (first time only)
                cachedSchemaModels = {};
                for (const [name, model] of Object.entries(getSequelize().models)) {
                    const isPublicModel = publicModels.includes(name);
                    
                    if (tenantId === CONTROL_PLANE || tenantId === 'health_check' || isPublicModel) {
                        cachedSchemaModels[name] = model.schema(PUBLIC_SCHEMA);
                    } else {
                        // STRICT GUARD: Never bind tenant models to public
                        if (schemaName === PUBLIC_SCHEMA || !schemaName.startsWith(TENANT_SCHEMA_PREFIX)) {
                            throw new Error(`🚨 PRODUCTION FAILURE: Tenant model '${name}' cannot be used in public schema.`);
                        }
                        cachedSchemaModels[name] = model.schema(schemaName);
                    }
                }
                
                // Cache for future requests (LRU style)
                if (tenantModelCache.size >= TENANT_CACHE_MAX_SIZE) {
                    const firstKey = tenantModelCache.keys().next().value;
                    tenantModelCache.delete(firstKey);
                }
                tenantModelCache.set(cacheKey, cachedSchemaModels);
            }
            
            // Use cached models
            Object.assign(tenantModels, cachedSchemaModels);
            transaction.models = tenantModels;

            let result;
            try {
                const sequelizeInstance = getSequelize();
                result = await operation(transaction, {
                    tenantId,
                    operationId,
                    transactionId,
                    sequelize: sequelizeInstance,
                    models: sequelizeInstance.models,
                    transactionModels: transaction.models
                });
                
                await transaction.commit();
                
                return {
                    success: true,
                    data: result,
                    operationId,
                    transactionId,
                    tenantId,
                    duration: Date.now() - this.activeTransactions.get(transactionId).startTime
                };
            } catch (operationError) {
                if (!transaction.finished) await transaction.rollback();
                throw operationError;
            }
        } catch (error) {
            if (transaction && !transaction.finished) {
                try {
                    await transaction.rollback();
                } catch (rollbackError) {
                    // Silent rollback failure
                }
            }
            
            // FAST FAIL: 503 for missing schema
            if (error.code === 'SCHEMA_MISSING') {
                return {
                    success: false,
                    error: 'Tenant not ready, please retry',
                    statusCode: 503,
                    tenantId
                };
            }
            
            throw error;
        } finally {
            this.activeTransactions.delete(transactionId);
        }
    }

    /**
     * Read-only operation with tenant schema
     * Optimized for read performance
     */
    async readWithTenant(tenantId, operation) {
        return this.executeWithTenant(tenantId, async (transaction, context) => {
            await getSequelize().query('SET TRANSACTION READ ONLY', { transaction });
            return await operation(transaction, context);
        }, {
            type: Sequelize.Transaction.TYPES.DEFERRED
        });
    }

    /**
     * Write operation with tenant schema
     * Ensures proper write isolation
     */
    async writeWithTenant(tenantId, operation) {
        return this.executeWithTenant(tenantId, async (transaction, context) => {
            // Ensure write mode and proper locking
            const result = await operation(transaction, context);
            
            return result;
        }, {
            isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.REPEATABLE_READ,
            type: Sequelize.Transaction.TYPES.DEFERRED
        });
    }

    /**
     * Execute operation in Public Schema (Control Plane)
     * Convenience wrapper for executeWithTenant(CONTROL_PLANE, ...)
     */
    async executeInPublic(operation, options = {}) {
        return this.executeWithTenant(CONTROL_PLANE, operation, options);
    }

    /**
     * Batch operations with single transaction
     * Efficient for multiple operations on same tenant
     */
    async batchWithTenant(tenantId, operations) {
        return this.executeWithTenant(tenantId, async (transaction, context) => {
            const results = [];
            
            for (let i = 0; i < operations.length; i++) {
                const operation = operations[i];
                
                try {
                    const result = await operation(transaction, context);
                    results.push({ success: true, data: result, index: i });
                } catch (error) {
                    results.push({ success: false, error: error.message, index: i });
                    
                    if (operation.failFast !== false) {
                        throw new Error(`Batch operation failed at index ${i}: ${error.message}`);
                    }
                }
            }
            
            return {
                results,
                totalOperations: operations.length,
                successfulOperations: results.filter(r => r.success).length,
                failedOperations: results.filter(r => !r.success).length
            };
        }, {
            type: getSequelize().Transaction.TYPES.DEFERRED
        });
    }

    /**
     * Execute across multiple tenants (admin operations)
     */
    async executeAcrossTenants(tenantIds, operation, options = {}) {
        const results = [];
        const { concurrency = 5, timeoutMs = 5000, failFast = false } = options;
        
        for (let i = 0; i < tenantIds.length; i += concurrency) {
            const batch = tenantIds.slice(i, i + concurrency);
            
            const batchPromises = batch.map(async (tenantId) => {
                return new Promise(async (resolve) => {
                    const timer = setTimeout(() => {
                        resolve({ tenantId, success: false, error: 'Operation timed out', isTimeout: true });
                    }, timeoutMs);

                    try {
                        const result = await this.executeWithTenant(tenantId, operation);
                        clearTimeout(timer);
                        resolve({ tenantId, success: true, data: result.data });
                    } catch (error) {
                        clearTimeout(timer);
                        resolve({ tenantId, success: false, error: error.message });
                    }
                });
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            if (failFast && batchResults.some(r => !r.success)) break;
        }
        
        return {
            results,
            totalTenants: tenantIds.length,
            successfulTenants: results.filter(r => r.success).length,
            failedTenants: results.filter(r => !r.success).length,
            timeouts: results.filter(r => r.isTimeout).length
        };
    }

    /**
     * Get transaction statistics and health
     */
    getTransactionStats() {
        const activeCount = this.activeTransactions.size;
        const transactions = Array.from(this.activeTransactions.entries()).map(([id, info]) => ({
            id,
            tenantId: info.tenantId,
            operationId: info.operationId,
            operation: info.operation,
            duration: Date.now() - info.startTime
        }));

        return {
            activeTransactions: activeCount,
            totalOperations: this.operationCounter,
            transactions,
            health: activeCount > 10 ? 'WARNING' : 'HEALTHY'
        };
    }

    /**
     * Cleanup hanging transactions
     */
    async cleanupHangingTransactions(timeoutMs = 120000) {
        const now = Date.now();
        const hangingTransactions = [];

        for (const [transactionId, info] of this.activeTransactions.entries()) {
            if (now - info.startTime > timeoutMs) {
                hangingTransactions.push({ transactionId, info });
            }
        }

        for (const { transactionId, info } of hangingTransactions) {
            try {
                await info.transaction.rollback();
                this.activeTransactions.delete(transactionId);
            } catch (error) {
                // Silent cleanup failure
            }
        }

        return hangingTransactions.length;
    }

    /**
     * Health check for transaction system
     */
    async healthCheck() {
        try {
            // Test basic transaction with schema switching
            const testResult = await this.executeWithTenant('health_check', async (transaction) => {
                await getSequelize().query('SELECT 1 as health_check', { 
                    transaction,
                    type: Sequelize.QueryTypes.SELECT 
                });
                return 'HEALTHY';
            });

            if (testResult === 'HEALTHY' || testResult?.success) {
                return {
                    healthy: true,
                    message: 'Neon transaction-safe system working properly',
                    stats: this.getTransactionStats()
                };
            } else {
                throw new Error(testResult?.error || 'Unknown health check failure');
            }

        } catch (error) {
            return {
                healthy: false,
                message: `Neon transaction system error: ${error.message}`,
                stats: this.getTransactionStats()
            };
        }
    }
}

// Singleton instance
const neonTransactionSafeExecutor = new NeonTransactionSafeExecutor();

// Export main executor and cache utilities
module.exports = neonTransactionSafeExecutor;
module.exports.clearTenantModelCache = clearTenantModelCache;
module.exports.getTenantCacheStats = getTenantCacheStats;
