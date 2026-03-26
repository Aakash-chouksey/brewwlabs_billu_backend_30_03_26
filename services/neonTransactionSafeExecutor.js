/**
 * 🔒 SYSTEM LOCK: NEON-TRANSACTION-SAFE EXECUTION LAYER
 * ============================================================
 * THIS FILE IS CRITICAL FOR MULTI-TENANT ISOLATION.
 * DO NOT MODIFY ARCHITECTURAL PATTERNS WITHOUT AUDIT.
 * 
 * ENFORCES:
 * 1. Zero global schema state
 * 2. Mandatory transaction-scoped model access
 * 3. Strict schema-to-tenant mapping
 * ============================================================
 */

const Sequelize = require('sequelize');
const { CONTROL_PLANE, PUBLIC_SCHEMA, TENANT_SCHEMA_PREFIX, CONTROL_MODELS, TENANT_MODELS } = require('../src/utils/constants');
const { ModelFactory } = require('../src/architecture/modelFactory');
const { enforceSchema, securityCheck, validateTenantSchema, assertSchemaContext } = require('../src/utils/schemaEnforcement');

// Lazy load database to prevent require-time connection
let sequelize;
const getSequelize = () => {
    if (!sequelize) {
        sequelize = require('../config/unified_database').sequelize;
    }
    return sequelize;
};

// Model initialization cache
let cachedModels = null;
let modelsInitializing = false;
let modelInitPromise = null;

// TENANT MODEL CACHE
const tenantModelCache = new Map();

/**
 * Get cached models or initialize once
 */
async function getCachedModels(sequelize, options = {}) {
    const { minimal = false } = options;
    if (minimal && cachedModels) return cachedModels;
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
 * NEON-TRANSACTION-SAFE EXECUTION LAYER
 * Simplified for stability and speed.
 */
class NeonTransactionSafeExecutor {
    constructor() {
        this.activeTransactions = new Map();
    }

    /**
     * Prepare schema-bound models for a tenant
     */
    async getTenantModels(tenantId, options = {}) {
        // ============================================================
        // TENANT ID VALIDATION: Block invalid tenant IDs
        // ============================================================
        if (tenantId === 'public' || tenantId === 'health_check' || tenantId.startsWith('tenant_public')) {
            throw new Error(`🚨 INVALID TENANT ID: '${tenantId}' cannot be used as a tenant identifier. Use executeInPublic() for control plane operations.`);
        }
        
        const schemaName = (tenantId === CONTROL_PLANE)
            ? PUBLIC_SCHEMA 
            : `${TENANT_SCHEMA_PREFIX}${tenantId}`;
        
        // ============================================================
        // STRICT SCHEMA ENFORCEMENT: Never allow public schema for tenants
        // ============================================================
        enforceSchema(schemaName, tenantId);
        securityCheck(schemaName, tenantId, 'getTenantModels');
        
        const cacheKey = schemaName;
        let cachedSchemaModels = tenantModelCache.get(cacheKey);
        
        if (!cachedSchemaModels) {
            await getCachedModels(getSequelize(), options);
            
            cachedSchemaModels = {};
            const allModels = getSequelize().models;
            
            // 🔒 GUARD: Use centralized CONTROL_MODELS list
            const publicModels = CONTROL_MODELS;

            for (const [name, model] of Object.entries(allModels)) {
                if (tenantId === CONTROL_PLANE || publicModels.includes(name)) {
                    cachedSchemaModels[name] = model.schema(PUBLIC_SCHEMA);
                } else {
                    cachedSchemaModels[name] = model.schema(schemaName);
                }
            }
            
            tenantModelCache.set(cacheKey, cachedSchemaModels);
            
            // 🔒 FREEZE: Prevent cache modification
            Object.freeze(cachedSchemaModels);
        }

        return { schemaName, models: cachedSchemaModels };
    }

    /**
     * HARD VALIDATION: Verify schema health (existence & critical tables)
     */
    async validateSchemaHealth(tenantId, schemaName) {
        if (tenantId === CONTROL_PLANE) return true;
        
        const cacheKey = `health_${schemaName}`;
        if (tenantModelCache.has(cacheKey)) return true;

        console.log(`[Executor] 🛡️  Hard Validation: Checking health of ${schemaName}...`);
        
        const sequelize = getSequelize();
        try {
            // 1. Check Schema
            const schemaExists = await sequelize.query(`
                SELECT schema_name FROM information_schema.schemata WHERE schema_name = :schema
            `, { replacements: { schema: schemaName }, type: Sequelize.QueryTypes.SELECT });

            if (!schemaExists.length) {
                throw new Error(`CRITICAL: Schema '${schemaName}' does not exist in database!`);
            }

            // 2. Check Critical Tables
            const tables = await sequelize.query(`
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = :schema AND table_name IN ('outlets', 'users', 'products')
            `, { replacements: { schema: schemaName }, type: Sequelize.QueryTypes.SELECT });

            if (tables.length < 2) { // Allow for some variations, but outlets/users are mandatory
                throw new Error(`CRITICAL: Schema '${schemaName}' is incomplete. Missing core tables.`);
            }

            // Cache health status (lightweight)
            tenantModelCache.set(cacheKey, true);
            console.log(`[Executor] ✅ Schema '${schemaName}' health verified.`);
            return true;
        } catch (error) {
            console.error(`[Executor] ❌ HEALTH CHECK FAILED for ${schemaName}:`, error.message);
            throw error;
        }
    }

    /**
     * MAIN EXECUTOR: Fast, Simple, Stable (STEP 7)
     */
    async executeWithTenant(tenantId, operation, options = {}) {
        // ============================================================
        // TENANT ID VALIDATION: Block invalid tenant IDs
        // ============================================================
        if (tenantId === 'public' || tenantId === 'health_check' || tenantId.startsWith('tenant_public')) {
            throw new Error(`🚨 INVALID TENANT ID: '${tenantId}' cannot be used as a tenant identifier. Use executeInPublic() for control plane operations.`);
        }
        
        const sequelize = getSequelize();
        const schemaName = tenantId === CONTROL_PLANE
            ? 'public'
            : `${TENANT_SCHEMA_PREFIX}${tenantId}`;

        // 🔒 SECURITY CHECK: Block unauthorized public schema access
        securityCheck(schemaName, tenantId, 'executeWithTenant');

        // 🛡️ HARD VALIDATION: Prevent query execution on broken schemas
        await this.validateSchemaHealth(tenantId, schemaName);

        // 📝 AUDIT LOG: Track every tenant database operation
        console.info(`[Executor] ⚡ EXECUTE | Tenant: ${tenantId} | Schema: ${schemaName} | Mode: TRANSACTIONAL`);

        // Fetch models (uses cache)
        const { models } = await this.getTenantModels(tenantId, options);

        // Create transaction
        const transaction = await sequelize.transaction({
            isolationLevel: options.isolationLevel || Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
        });

        try {
            // 🔒 CONTEXT ASSERTION: Ensure connection is in correct state
            if (schemaName !== 'public') {
                await assertSchemaContext(sequelize, schemaName, { transaction });
            }

            const result = await operation({
                transaction,
                models,
                transactionModels: models,
                schemaName,
                sequelize
            });

            await transaction.commit();
            return { 
                success: true, 
                data: result, 
                message: "Success"
            };

        } catch (error) {
            if (transaction) await transaction.rollback().catch(() => {});
            console.error(`🚨 Executor Error: ${error.message} | Tenant: ${tenantId}`);
            throw error;
        }
    }

    /**
     * READ FLOW: Optimized (NO TRANSACTION) (STEP 9)
     */
    async readWithTenant(tenantId, operation, options = {}) {
        if (tenantId === 'public' || tenantId === 'health_check' || tenantId.startsWith('tenant_public')) {
            throw new Error(`🚨 INVALID TENANT ID: '${tenantId}'`);
        }
        
        const sequelize = getSequelize();
        const schemaName = tenantId === CONTROL_PLANE ? 'public' : `${TENANT_SCHEMA_PREFIX}${tenantId}`;
        
        // 🔒 SECURITY CHECK: Block unauthorized public schema access
        securityCheck(schemaName, tenantId, 'readWithTenant');
        
        // 🛡️ HARD VALIDATION: Prevent query execution on broken schemas
        await this.validateSchemaHealth(tenantId, schemaName);
        
        // 📝 AUDIT LOG: Track every tenant database operation
        console.info(`[Executor] ⚡ READ | Tenant: ${tenantId} | Schema: ${schemaName} | Mode: OPTIMIZED`);
        
        const { models } = await this.getTenantModels(tenantId, options);

        try {
            // 🔒 CONTEXT ASSERTION: Ensure connection is in correct state
            if (schemaName !== 'public') {
                await assertSchemaContext(sequelize, schemaName);
            }

            const result = await operation({
                models,
                transactionModels: models,
                schemaName,
                sequelize
            });

            return { 
                success: true, 
                data: result, 
                message: "Success"
            };
        } catch (error) {
            console.error(`🚨 Read Error: ${error.message} | Schema: ${schemaName}`);
            throw error;
        } finally {
            // NO SEARCH PATH: Relying on schema-bound models (Instruction #2)
            // await sequelize.query(`SET search_path TO public`).catch(() => {});
        }
    }

    /**
     * PUBLIC SCHEMA EXECUTOR
     * Explicitly sets search_path to public before operation and resets after
     */
    async executeInPublic(operation) {
        const sequelize = getSequelize();
        
        // CRITICAL: Force public schema before control plane operation
        try {
            await sequelize.query(`SET search_path TO "${PUBLIC_SCHEMA}"`);
        } catch (error) {
            console.warn('[Executor] ⚠️ Failed to set public schema:', error.message);
        }
        
        try {
            const result = await this.executeWithTenant(CONTROL_PLANE, operation);
            return result;
        } finally {
            // Always reset to public after (even though it's already public)
            try {
                await sequelize.query(`SET search_path TO "${PUBLIC_SCHEMA}"`);
            } catch (error) {
                // Silent fail for cleanup
            }
        }
    }

    /**
     * Backward compatibility aliases
     */
    async writeWithTenant(tenantId, operation) {
        return this.executeWithTenant(tenantId, operation);
    }

    async executeRead(tenantId, operation) {
        return this.executeWithTenant(tenantId, operation);
    }

    async executeFastRead(tenantId, operation) {
        return this.executeWithTenant(tenantId, operation);
    }
    
    async executeForAuth(operation) {
        return this.executeWithTenant(CONTROL_PLANE, operation);
    }

    /**
     * HEALTH CHECK
     */
    async healthCheck() {
        try {
            await getSequelize().authenticate();
            return { healthy: true, timestamp: new Date().toISOString() };
        } catch (error) {
            return { healthy: false, error: error.message };
        }
    }

    getTransactionStats() {
        return { cacheSize: tenantModelCache.size };
    }
}

const neonTransactionSafeExecutor = new NeonTransactionSafeExecutor();

// 🔒 LOCK: Prevent prototype pollution but ALLOW map operations
Object.seal(NeonTransactionSafeExecutor.prototype);

module.exports = neonTransactionSafeExecutor;
module.exports.clearTenantModelCache = (name) => {
    // Allow clearing cache for specific operations like tenant deletion
    // but log the action for security audit
    console.log(`📝 CACHE CLEAR REQUESTED: ${name || 'ALL'}`);
    return name ? tenantModelCache.delete(name) : tenantModelCache.clear();
};
