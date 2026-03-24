const createHttpError = require('http-errors');
const neonTransactionSafeSchemaManager = require('../services/neonTransactionSafeSchemaManager');
const unifiedTenantService = require('../services/unifiedTenantService');

/**
 * NEON-COMPATIBLE TENANT MIDDLEWARE
 * 
 * CRITICAL: Replaces unsafe schema switching with transaction-safe approach
 * REQUIRED for Neon serverless PostgreSQL compatibility
 */
const neonCompatibleTenantMiddleware = async (req, res, next) => {
    const startTime = Date.now();
    
    try {
        // 1. Authentication check
        if (!req.auth) {
            return next(createHttpError(401, "Authentication required"));
        }

        // 2. Super Admin bypass
        if (req.auth.role === "SUPER_ADMIN") {
            console.log('🔓 SUPER ADMIN access - bypassing tenant resolution');
            req.tenantId = null;
            req.tenantSchema = null;
            req.isSuperAdmin = true;
            req.neonTransactionSafe = true;
            return next();
        }

        // 3. Validate tenant access
        if (req.auth.panelType !== "TENANT") {
            return next(createHttpError(403, "Tenant access required"));
        }

        // 4. Extract tenant identifier
        const tenantId = req.auth.brandId || req.auth.businessId;

        if (!tenantId) {
            console.error(`❌ CRITICAL: Missing tenant identifier in JWT token for user ${req.auth.email}`);
            return next(createHttpError(400, "Invalid JWT token: tenant identifier (brandId/businessId) is required"));
        }

        console.log(`🔍 Neon-Compatible Tenant Resolution: tenantId=${tenantId} (from JWT)`);

        // 5. CRITICAL VALIDATION: Prevent JWT corruption
        if (req.auth.brandId && req.auth.businessId && req.auth.brandId === req.auth.businessId) {
            console.error(`❌ CRITICAL: brandId equals businessId (${tenantId}) - JWT token corruption detected`);
            return next(createHttpError(400, 'Invalid JWT token: brandId cannot equal businessId'));
        }

        // 6. Validate tenant exists
        const tenantValidation = await unifiedTenantService.validateTenant(tenantId);
        if (!tenantValidation.valid) {
            return next(createHttpError(403, 'Tenant not accessible or does not exist'));
        }

        // 7. Set tenant context (NO SCHEMA SWITCHING HERE)
        req.tenantId = tenantId;
        req.tenantSchema = `tenant_${tenantId}`;
        req.businessId = req.auth.businessId;
        req.outletId = req.auth.outletId || null;
        req.isSuperAdmin = false;
        req.neonTransactionSafe = true;
        
        // 🚨 STRICT OUTLET VALIDATION: Outlet-specific roles MUST have outletId
        const userRole = req.auth.role;
        const isOutletRole = ['OUTLET_ADMIN', 'OUTLET_MANAGER', 'OUTLET_STAFF', 'STAFF', 'CASHIER'].includes(userRole);
        
        if (isOutletRole && !req.outletId) {
            console.error('🚨 SECURITY VIOLATION: Outlet role without outletId', {
                role: userRole,
                userId: req.auth.id,
                path: req.path
            });
            return next(createHttpError(403, '🚨 Access denied: Outlet ID required for your role'));
        }

        // 8. Set tenant object for backward compatibility
        req.tenant = {
            id: tenantId,
            schema: req.tenantSchema,
            businessId: req.auth.businessId,
            outletId: req.auth.outletId
        };

        // 9. Special case: SuperAdmin impersonation
        if (req.auth.role === 'SUPER_ADMIN' && req.path.includes('/admin/')) {
            const targetBusinessId = req.headers['x-business-id'] || req.headers['x-tenant-id'];
            const targetOutletId = req.headers['x-outlet-id'];

            if (targetBusinessId) {
                req.tenant.businessId = targetBusinessId;
                req.businessId = targetBusinessId;
            }
            if (targetOutletId) {
                req.tenant.outletId = targetOutletId;
                req.outletId = targetOutletId;
            }
        }

        const duration = Date.now() - startTime;
        console.log(`🌐 Neon-Compatible Tenant Context [${req.method} ${req.path}]:`, {
            role: req.auth.role,
            tenantId: req.tenantId,
            schema: req.tenantSchema,
            businessId: req.businessId,
            outletId: req.outletId,
            duration: `${duration}ms`,
            transactionSafe: true
        });
        
        next();

    } catch (error) {
        console.error('🔥 Neon-Compatible Tenant Middleware Error:', error);
        
        if (error.message.includes('database') || error.message.includes('connection')) {
            return next(createHttpError(503, 'Tenant database temporarily unavailable. Please try again.'));
        }
        
        if (error.message.includes('tenant') || error.message.includes('schema')) {
            return next(createHttpError(400, 'Tenant resolution failed. Please check your credentials.'));
        }
        
        next(createHttpError(500, 'Tenant context initialization failed'));
    }
};

/**
 * NEON-COMPATIBLE MODEL INJECTION
 * 
 * Provides transaction-safe model access methods
 */
const neonCompatibleModelInjection = async (req, res, next) => {
    try {
        // Skip for Super Admin on admin routes
        if (req.isSuperAdmin && req.path.includes('/admin/')) {
            console.log('🔓 SUPER ADMIN - skipping model injection for admin routes');
            return next();
        }

        // Ensure models are available
        if (!req.models || !req.models.Business) {
            return next(createHttpError(500, 'Models not properly injected'));
        }

        // Add Neon-transaction-safe methods to request
        req.executeWithTenantSchema = (operation) => {
            return neonTransactionSafeSchemaManager.executeWithTenantSchema(req.tenantId, operation);
        };

        req.readWithTenantSchema = (operation) => {
            return neonTransactionSafeSchemaManager.readWithTenantSchema(req.tenantId, operation);
        };

        req.writeWithTenantSchema = (operation) => {
            return neonTransactionSafeSchemaManager.writeWithTenantSchema(req.tenantId, operation);
        };

        req.batchWithTenantSchema = (operations) => {
            return neonTransactionSafeSchemaManager.batchWithTenantSchema(req.tenantId, operations);
        };

        console.log(`✅ Neon-compatible model injection successful for tenant: ${req.tenantId}`);
        next();

    } catch (error) {
        console.error('❌ Neon-Compatible Model Injection Error:', error.message);
        next(createHttpError(500, 'Model injection failed'));
    }
};

/**
 * WARNING: UNSAFE SCHEMA USAGE DETECTOR
 * 
 * Detects and blocks direct schema switching outside transactions
 */
const unsafeSchemaUsageDetector = (req, res, next) => {
    // Skip for Super Admin
    if (req.isSuperAdmin) {
        return next();
    }

    // Override sequelize.query to detect unsafe schema switching
    const originalQuery = req.models.sequelize.query;
    
    req.models.sequelize.query = function(...args) {
        const [sql, options = {}] = args;
        
        // Detect unsafe schema switching
        if (sql.includes('SET search_path') && !options.transaction) {
            console.error('🚨 UNSAFE SCHEMA SWITCHING DETECTED:', {
                sql,
                path: req.path,
                tenantId: req.tenantId,
                user: req.auth?.email,
                timestamp: new Date().toISOString()
            });
            
            // Block the request
            return res.status(500).json({
                error: 'Security Violation',
                message: 'Unsafe schema switching detected. Use transaction-safe methods.'
            });
        }
        
        // Call original query
        return originalQuery.apply(this, args);
    };
    
    next();
};

module.exports = {
    neonCompatibleTenantMiddleware,
    neonCompatibleModelInjection,
    unsafeSchemaUsageDetector
};
