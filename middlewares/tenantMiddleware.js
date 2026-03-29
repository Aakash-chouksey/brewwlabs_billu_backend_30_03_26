const createHttpError = require('http-errors');
const neonTransactionSafeExecutor = require('../services/neonTransactionSafeExecutor');
const unifiedTenantService = require('../services/unifiedTenantService');

/**
 * NEON-SAFE TENANT MIDDLEWARE
 * 
 * CRITICAL: Replaces all unsafe schema switching with transaction-safe execution
 * ENFORCES: Zero global schema state, all operations transaction-scoped
 */
const neonSafeTenantMiddleware = async (req, res, next) => {
    const startTime = Date.now();
    
    try {
        // 1. Authentication check
        if (!req.auth) {
            return next(createHttpError(401, "Authentication required"));
        }

        // 2. Super Admin bypass (no tenant context needed)
        if (req.auth.role === "SUPER_ADMIN") {
            console.log('🔓 SUPER ADMIN access - bypassing tenant resolution');
            req.tenantId = null;
            req.tenantSchema = null;
            req.isSuperAdmin = true;
            req.neonSafe = true;
            return next();
        }

        // 3. Validate tenant access
        if (req.auth.panelType !== "TENANT") {
            return next(createHttpError(403, "Tenant access required"));
        }

        // 4. Extract tenant identifier from JWT
        const tenantId = req.auth.brandId || req.auth.businessId;

        if (!tenantId) {
            console.error(`❌ CRITICAL: Missing tenant identifier in JWT token`);
            return next(createHttpError(400, "Invalid JWT token: tenant identifier (brandId/businessId) is required"));
        }

        // 5. CRITICAL VALIDATION: Prevent Context Overrides & JWT Corruption
        if (req.tenantId && req.tenantId !== tenantId) {
             console.error(`🚨 SECURITY VIOLATION: Tenant context already set to ${req.tenantId}, but JWT says ${tenantId}`);
             return next(createHttpError(403, "Tenant context conflict detected"));
        }

        if (req.auth.brandId && req.auth.businessId && req.auth.brandId === req.auth.businessId) {
            console.error(`❌ CRITICAL: brandId equals businessId (${tenantId}) - JWT token corruption detected`);
            return next(createHttpError(400, 'Invalid JWT token: brandId cannot equal businessId'));
        }

        // 6. Use pre-fetched tenant from tokenVerification (Phase 1 Optimization)
        if (!req.tenant || req.tenant.id !== tenantId) {
            const tenantValidation = await unifiedTenantService.validateTenant(tenantId);
            if (!tenantValidation.valid) {
                return next(createHttpError(403, 'Tenant not accessible or does not exist'));
            }
            req.tenant = tenantValidation.tenant;
        }

        // 7. Set tenant context (NO SCHEMA SWITCHING - CRITICAL)
        req.tenantId = tenantId;
        req.tenantSchema = `tenant_${tenantId}`; // Reference only
        req.businessId = req.auth.businessId;
        req.outletId = req.auth.outletId || null;
        req.isSuperAdmin = false;
        req.neonSafe = true;

        // 8. Use req.tenant from Phase 1 Optimization (tokenVerification)
        if (req.tenant && !req.tenant.schema) {
            req.tenant.schema = req.tenantSchema;
        }

        const resTime = Date.now() - startTime;
        req.timings.middlewareTime += resTime;
        
        console.log(`🌐 [NEON-SAFE] Tenant: ${req.tenantId} | Role: ${req.auth.role} | Init: ${resTime}ms`);
        
        next();

    } catch (error) {
        console.error('🔥 Neon-Safe Tenant Middleware Error:', error);
        next(createHttpError(500, 'Tenant context initialization failed'));
    }
};

/**
 * NEON-SAFE MODEL INJECTION MIDDLEWARE
 * 
 * Provides transaction-safe execution methods to controllers
 * ENFORCES: All DB operations must go through transaction-safe layer
 */
const neonSafeModelInjection = async (req, res, next) => {
    try {
        // PHASE 10: REMOVED unsafe global model getter. 
        // All business logic must use req.executeWithTenant or req.readWithTenant
        // which provides correctly bound transaction.models.
        console.log("🛡️ [PHASE 10] Enforcing transaction-scoped access.");

        // CRITICAL: Inject methods before any role-based bypass
        // This ensures req.executeRead is ALWAYS a function even if not authorized

        // CRITICAL: Provide only transaction-safe methods
        // NO direct model access allowed
        req.executeWithTenant = (operation, options = {}) => {
            if (!req.tenantId) {
                throw new Error('🚨 BLOCKED: Tenant ID required for database operations');
            }
            return neonTransactionSafeExecutor.executeWithTenant(req.tenantId, operation, options);
        };

        /**
         * PHASE 1: Optimized READ-ONLY execution (GET APIs)
         * Use for: dashboard, products, lists, analytics
         * NO transaction overhead - direct query with search_path
         */
        req.readWithTenant = (operation, options = {}) => {
            if (!req.tenantId) {
                throw new Error('🚨 BLOCKED: Tenant ID required for database operations');
            }
            return neonTransactionSafeExecutor.readWithTenant(req.tenantId, operation, options);
        };

        /**
         * PHASE 1.1: CACHED READ-ONLY execution
         * Use for high-traffic GET APIs like dashboard
         */
        req.readWithCache = (tenantId, key, operation, options = {}) => {
            // Support passing just key + operation for current tenant
            if (typeof tenantId === 'string' && tenantId !== req.tenantId && !key) {
               // key = tenantId;
               // tenantId = req.tenantId;
            }
            
            const targetTenantId = (typeof key === 'string') ? tenantId : req.tenantId;
            const targetKey = (typeof key === 'string') ? key : tenantId;
            const targetOperation = (typeof key === 'string') ? operation : key;
            const targetOptions = (typeof key === 'string') ? options : operation;

            if (!targetTenantId) {
                throw new Error('🚨 BLOCKED: Tenant ID required for cached database operations');
            }
            return neonTransactionSafeExecutor.readWithCache(targetTenantId, targetKey, targetOperation, targetOptions);
        };

        req.executeRead = req.readWithTenant;
        req.executeFastRead = req.readWithTenant;

        /**
         * PHASE 2: WRITE OPERATIONS (POST/PUT/DELETE APIs)
         * Transactional writes for data integrity
         */
        req.executeWrite = (operation, options = {}) => {
            if (!req.tenantId) {
                throw new Error('🚨 BLOCKED: Tenant ID required for database operations');
            }
            return neonTransactionSafeExecutor.executeWithTenant(req.tenantId, operation, options);
        };

        // Alias for backward compatibility
        req.writeWithTenant = req.executeWrite;
        req.executeWithTenant = req.executeWrite;

        req.batchWithTenant = (operations) => {
            if (!req.tenantId) {
                throw new Error('🚨 BLOCKED: Tenant ID required for database operations');
            }
            return neonTransactionSafeExecutor.batchWithTenant(req.tenantId, operations);
        };

        // Admin-only method for cross-tenant operations
        req.executeAcrossTenants = (tenantIds, operation) => {
            if (req.auth.role !== 'SUPER_ADMIN') {
                throw new Error('🚨 BLOCKED: Super Admin access required');
            }
            return neonTransactionSafeExecutor.executeAcrossTenants(tenantIds, operation);
        };

        next();

    } catch (error) {
        console.error('❌ Neon-Safe Model Injection Error:', error.message);
        next(createHttpError(500, 'Model injection failed'));
    }
};

/**
 * ROLE-BASED AUTHORIZATION MIDDLEWARE
 * 
 * Flexible role check for tenant-scoped routes
 * Supports: array of roles or single role
 */
const authorize = (roles = []) => {
    return (req, res, next) => {
        if (!req.auth || !req.auth.role) {
            return next(createHttpError(401, "Authentication required"));
        }

        const allowedRoles = Array.isArray(roles) ? roles : [roles];
        
        // Super Admin bypass for all routes (optional - can be strict)
        if (req.auth.role === 'SUPER_ADMIN') {
            return next();
        }

        if (!allowedRoles.includes(req.auth.role)) {
            console.error(`🚫 [AUTH] Access Denied: User role ${req.auth.role} not in allowed list [${allowedRoles}]`);
            return next(createHttpError(403, `Access denied: ${allowedRoles.join('/')} access required`));
        }

        next();
    };
};

module.exports = {
    neonSafeTenantMiddleware,
    neonSafeModelInjection,
    authorize
};
