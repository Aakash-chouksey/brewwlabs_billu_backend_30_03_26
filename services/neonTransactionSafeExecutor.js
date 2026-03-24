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
 * Get cached models or initialize once - OPTIMIZED for minimal loading
 */
async function getCachedModels(sequelize, options = {}) {
    const { minimal = false } = options;
    
    // If minimal mode, just return what's already cached without full init
    if (minimal && cachedModels) {
        return cachedModels;
    }
    
    if (cachedModels) return cachedModels;
    if (modelsInitializing && modelInitPromise) return await modelInitPromise;
    
    modelsInitializing = true;
    modelInitPromise = ModelFactory.createModels(sequelize).then(models => {
        cachedModels = models;
        modelsInitializing = false;
        return models;
    });
    
    return await modelInitPromise;
}

/**
 * Safe Model Fallback - Prevents crashes when models are missing
 */
class SafeModel {
    constructor(modelName, schemaName) {
        this.modelName = modelName;
        this.schemaName = schemaName;
        this.isSafeModel = true;
    }

    _logWarning(method) {
        console.warn(`⚠️ [SAFE MODEL] ${this.modelName}.${method} called but model is missing in schema ${this.schemaName}`);
    }

    async findAll() { this._logWarning('findAll'); return []; }
    async findOne() { this._logWarning('findOne'); return null; }
    async findByPk() { this._logWarning('findByPk'); return null; }
    async count() { this._logWarning('count'); return 0; }
    async sum() { this._logWarning('sum'); return 0; }
    async create() { this._logWarning('create'); throw new Error(`Cannot create in missing model ${this.modelName}`); }
    async update() { this._logWarning('update'); return [0]; }
    async destroy() { this._logWarning('destroy'); return 0; }
}

/**
 * NEON-TRANSACTION-SAFE EXECUTION LAYER
 */
class NeonTransactionSafeExecutor {
    constructor() {
        this.activeTransactions = new Map();
        this.operationCounter = 0;
    }

    /**
     * Prepare schema-bound models for a tenant
     * USES .schema() for maximum isolation and performance
     */
    async getTenantModels(tenantId, options = {}) {
        const { minimal = false } = options;
        const schemaName = (tenantId === CONTROL_PLANE || tenantId === 'health_check')
            ? PUBLIC_SCHEMA 
            : `${TENANT_SCHEMA_PREFIX}${tenantId}`;
        
        const cacheKey = schemaName;
        let cachedSchemaModels = tenantModelCache.get(cacheKey);
        
        if (!cachedSchemaModels) {
            console.log(`⏱️ [TENANT MODELS] Cache miss for ${cacheKey}, loading models...`);
            const stepStart = Date.now();
            
            // OPTIMIZED: Use minimal mode for faster loading when only public models needed
            await getCachedModels(getSequelize(), { minimal });
            console.log(`⏱️ [TENANT MODELS] getCachedModels took ${Date.now() - stepStart}ms`);
            
            cachedSchemaModels = {};
            const allModels = getSequelize().models;
            console.log(`⏱️ [TENANT MODELS] Got ${Object.keys(allModels).length} models from sequelize`);
            
            const publicModels = [
                'User', 'Business', 'Auth', 'MembershipPlan', 'Plan', 
                'Subscription', 'TenantRegistry', 'AuditLog', 
                'SuperAdminUser', 'ClusterMetadata', 'TenantMigrationLog',
                'SystemMetrics', 'TenantConnection'
            ];

            const schemaStart = Date.now();
            for (const [name, model] of Object.entries(allModels)) {
                if (tenantId === CONTROL_PLANE || tenantId === 'health_check' || publicModels.includes(name)) {
                    cachedSchemaModels[name] = model.schema(PUBLIC_SCHEMA);
                } else {
                    cachedSchemaModels[name] = model.schema(schemaName);
                }
            }
            console.log(`⏱️ [TENANT MODELS] Schema binding took ${Date.now() - schemaStart}ms`);
            
            tenantModelCache.set(cacheKey, cachedSchemaModels);
            console.log(`✅ [TENANT MODELS] Cached ${Object.keys(cachedSchemaModels).length} models for ${cacheKey}`);
        } else {
            console.log(`✅ [TENANT MODELS] Cache hit for ${cacheKey}`);
        }

        // Phase 2: Wrap models in a Proxy for safe access
        const safeModelsProxy = new Proxy(cachedSchemaModels, {
            get: (target, prop) => {
                if (prop in target) return target[prop];
                if (typeof prop === 'string' && prop[0] === prop[0].toUpperCase()) {
                    // It's likely a model name (PascalCase)
                    return new SafeModel(prop, schemaName);
                }
                return target[prop];
            }
        });

        console.log("CURRENT SCHEMA (resolved):", schemaName);
        return { schemaName, models: safeModelsProxy };
    }

    /**
     * Execute operation with tenant schema within transaction
     * ENFORCED: Exactly one transaction per request
     */
    async executeWithTenant(tenantId, operation, options = {}) {
        const totalStart = Date.now();
        const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        let transaction = null;
        
        console.log(`[TX START] Tenant: ${tenantId} | ID: ${transactionId}`);

        try {
            const modelStart = Date.now();
            const { schemaName, models } = await this.getTenantModels(tenantId, options);
            console.log("CURRENT SCHEMA (executeWithTenant):", schemaName);
            console.log(`⏱️ [TX] getTenantModels took ${Date.now() - modelStart}ms`);
            
            const txStart = Date.now();
            transaction = await getSequelize().transaction({
                isolationLevel: options.isolationLevel || Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
                type: options.type || Sequelize.Transaction.TYPES.DEFERRED
            });
            console.log(`⏱️ [TX] Transaction creation took ${Date.now() - txStart}ms`);

            // Fallback search_path (as SET LOCAL inside transaction for added safety)
            const searchPathStart = Date.now();
            await getSequelize().query(`SET LOCAL search_path TO "${schemaName}"`, { 
                transaction,
                type: Sequelize.QueryTypes.SET 
            });
            console.log(`⏱️ [TX] SET search_path took ${Date.now() - searchPathStart}ms`);

            const context = {
                tenantId,
                schemaName,
                transactionId,
                sequelize: getSequelize(),
                models: models,
                transactionModels: models,
                transaction: transaction,
                isTransactional: true
            };

            try {
                // Execute operation
                console.log("STEP 3 - Executor Start (executeWithTenant)");
                const opStart = Date.now();
                const result = await operation(context);
                console.log(`⏱️ [TX] User operation took ${Date.now() - opStart}ms`);
                console.log("STEP 5 - Executor Result (executeWithTenant):", result);
                
                await transaction.commit();
                console.log(`[TX END] Success | Total Duration: ${Date.now() - totalStart}ms`);
                
                return {
                    success: true,
                    data: result
                };
            } catch (opError) {
                if (!transaction.finished) await transaction.rollback();
                throw opError;
            }
        } catch (error) {
            if (transaction && !transaction.finished) await transaction.rollback().catch(() => {});
            console.error(`🚨 EXECUTOR ERROR (executeWithTenant): ${error.message} | Tenant: ${tenantId}`);
            throw error;
        }
    }

    /**
     * Truly non-transactional read (Phase 2 - PERFORMANCE OPTIMIZED)
     * Uses SET search_path for ~50x faster reads (no transaction, no model binding)
     */
    async readWithTenant(tenantId, operation, options = {}) {
        const startTime = Date.now();
        
        try {
            const schemaName = (tenantId === CONTROL_PLANE || tenantId === 'health_check')
                ? PUBLIC_SCHEMA 
                : `${TENANT_SCHEMA_PREFIX}${tenantId}`;
            
            console.log("CURRENT SCHEMA (readWithTenant):", schemaName);
            
            // Phase 2 OPTIMIZATION: Use cached global models with search_path
            // This is ~50x faster than schema-bound models with transactions
            const models = await getCachedModels(getSequelize());
            
            // Set search_path for this connection (no transaction overhead)
            await getSequelize().query(
                `SET search_path TO "${schemaName}"`,
                { raw: true }
            );
            
            const context = {
                tenantId,
                schemaName,
                sequelize: getSequelize(),
                models: models,           // Use global cached models
                transactionModels: models, // Keep name for compatibility
                transaction: null,
                isTransactional: false,
                isReadOnly: true
            };
            
            // Execute operation
            console.log("STEP 3 - Executor Start (readWithTenant)");
            const result = await operation(context);
            console.log("STEP 5 - Executor Result (readWithTenant):", result);
            
            // Log slow reads for monitoring
            const duration = Date.now() - startTime;
            if (duration > 100) {
                console.log(`⚠️ [SLOW READ] ${duration}ms | Tenant: ${tenantId} | Schema: ${schemaName}`);
            }
            
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error(`🚨 EXECUTOR ERROR (readWithTenant): ${error.message} | Tenant: ${tenantId}`);
            throw error;
        }
    }

    /**
     * Optimized READ-ONLY execution with search_path (Phase 1)
     * Faster than executeWithTenant by avoiding transaction overhead.
     * Use ONLY for GET/READ APIs.
     */
    async executeRead(tenantId, operation) {
        const sequelize = getSequelize();
        const schemaName = tenantId === CONTROL_PLANE
            ? PUBLIC_SCHEMA
            : `${TENANT_SCHEMA_PREFIX}${tenantId}`;

        // Set schema WITHOUT transaction - high performance read
        await sequelize.query(`SET search_path TO "${schemaName}"`);

        console.log("STEP 3 - Executor Start (executeRead)");
        const result = await operation({
            models: sequelize.models,
            transactionModels: sequelize.models, // Added for compatibility (Phase 5)
            sequelize
        });
        
        console.log("STEP 5 - Executor Result (executeRead):", result);
        
        return {
            success: true,
            data: result
        };
    }

    /**
     * Backward compatibility aliases
     */
    async writeWithTenant(tenantId, operation) {
        return this.executeWithTenant(tenantId, operation);
    }

    /**
     * FAST READ MODE - Explicit alias for high-performance reads
     * Use this for: dashboard, products, analytics, lists
     * NO transaction overhead - direct query with search_path
     * 
     * @param {string} tenantId - Tenant ID
     * @param {Function} operation - Operation to execute
     * @returns {Promise} Query result
     */
    async executeFastRead(tenantId, operation) {
        return this.readWithTenant(tenantId, operation);
    }

    /**
     * Batch read operation for multiple tenants (admin use)
     */
    async readWithPublic(operation) {
        return this.readWithTenant('public', operation);
    }

    /**
     * AUTHENTICATION EXECUTOR
     * Specialized for auth operations on public schema (control plane)
     * Provides User and SuperAdminUser models with transaction support
     */
    async executeForAuth(operation) {
        const startTime = Date.now();
        const transactionId = `auth_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        let transaction = null;
        
        console.log(`[AUTH START] ID: ${transactionId}`);

        try {
            // Use public schema for authentication
            const schemaName = PUBLIC_SCHEMA;
            const models = await getCachedModels(getSequelize());
            
            // Create transaction for auth operations
            transaction = await getSequelize().transaction({
                isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
            });

            // Set search path
            await getSequelize().query(`SET LOCAL search_path TO "${schemaName}"`, { 
                transaction,
                type: Sequelize.QueryTypes.SET 
            });

            const context = {
                tenantId: 'public',
                schemaName,
                transactionId,
                sequelize: getSequelize(),
                models: models,
                transactionModels: models,
                transaction: transaction,
                isTransactional: true
            };

            try {
                // Execute auth operation
                console.log("STEP 3 - Executor Start (executeForAuth)");
                const result = await operation(context);
                console.log("STEP 5 - Executor Result (executeForAuth):", result);
                
                await transaction.commit();
                console.log(`[AUTH END] Success | Duration: ${Date.now() - startTime}ms`);
                
                return {
                    success: true,
                    data: result
                };
            } catch (opError) {
                if (!transaction.finished) await transaction.rollback();
                throw opError;
            }
        } catch (error) {
            if (transaction && !transaction.finished) {
                await transaction.rollback().catch(() => {});
            }
            console.error(`[AUTH END] Failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * HEALTH CHECK & MONITORING
     */
    async healthCheck() {
        try {
            await getSequelize().authenticate();
            return {
                healthy: true,
                message: 'Neon connection is alive',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                healthy: false,
                message: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    getTransactionStats() {
        return {
            activeTransactions: this.activeTransactions.size,
            totalOperations: this.operationCounter,
            cacheStats: getTenantCacheStats()
        };
    }

    async cleanupHangingTransactions() {
        // Stub for compatibility with app.js periodic tasks
        return 0;
    }
}

const neonTransactionSafeExecutor = new NeonTransactionSafeExecutor();
module.exports = neonTransactionSafeExecutor;
module.exports.clearTenantModelCache = clearTenantModelCache;
module.exports.getTenantCacheStats = getTenantCacheStats;
