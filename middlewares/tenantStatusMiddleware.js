const createHttpError = require('http-errors');
const { sequelize } = require('../config/unified_database');
const { TENANT_STATUS, ALLOWED_PROTECTED_STATUSES } = require('../src/utils/tenantConstants');

// Local cache to prevent DB hammering on every request
const statusCache = new Map();
const CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Tenant Status Middleware
 * Hardened access control for multi-tenant requests
 * Ensures only active/ready/trial tenants can access protected APIs
 */
const tenantStatusMiddleware = async (req, res, next) => {
    try {
        const business_id = req.business_id || req.businessId;
        
        // 1. SKIP IF BYPASSABLE: No business context or check already passed for Super Admin
        if (!business_id || req.user?.role === 'SUPER_ADMIN') {
            return next();
        }

        // 2. EXCLUDE PUBLIC/ONBOARDING ROUTES: Allow specific routes even if tenant/outlet is not ready
        const publicTenantPaths = ['/status', '/profile', '/onboarding', '/health', '/outlet/create', '/outlets'];
        if (publicTenantPaths.some(path => req.path.includes(path))) {
            return next();
        }

        // 3. OUTLET CONFIGURATION CHECK: Ensure user has at least one outlet configured
        // req.user is populated by tokenVerification middleware
        if (!req.user?.outletId) {
            console.warn(`🚫 [TenantStatus] Blocking request for user ${req.user?.id} - No outlet configured.`);
            return next(createHttpError(400, "Outlet not configured. Please complete setup."));
        }

        const now = Date.now();
        const cached = statusCache.get(business_id);

        // 4. CACHE CHECK: Optimized hit with case-insensitive protection
        if (cached && (now - cached.timestamp < CACHE_TTL)) {
            const cachedStatus = (cached.status || '').toUpperCase();
            
            if (!ALLOWED_PROTECTED_STATUSES.includes(cachedStatus)) {
                console.warn(`🚫 [TenantStatus] Blocking via CACHE for tenant ${business_id}. Status: ${cachedStatus}`);
                return next(createHttpError(403, `Tenant account is ${cachedStatus}. Access denied.`));
            }
            return next();
        }

        // 4. DATABASE CHECK: Direct model query for registry status
        const TenantRegistry = sequelize.models.TenantRegistry.schema('public');
        const registry = await TenantRegistry.findOne({
            where: { businessId: business_id },
            attributes: ['status']
        });

        if (!registry) {
            console.error(`🚨 [TenantStatus] Tenant ${business_id} NOT FOUND in Registry.`);
            return next(createHttpError(404, 'Tenant registration not found. Access denied.'));
        }

        const status = (registry.status || '').toUpperCase();
        console.log(`🔍 [TenantStatus] Debug - Tenant: ${business_id}, Status: ${status}`);

        // Update cache
        statusCache.set(business_id, {
            status,
            timestamp: now
        });

        // 5. ENFORCEMENT: Strictly check against allowed statuses for protected routes
        if (!ALLOWED_PROTECTED_STATUSES.includes(status)) {
            console.warn(`🚫 [TenantStatus] Blocking tenant ${business_id}. Status: ${status}`);
            
            // Specialized error messages for specific states
            if (status === TENANT_STATUS.INIT_FAILED) {
                return next(createHttpError(403, 'Tenant setup failed. Please contact support.'));
            }
            if (status === TENANT_STATUS.INIT_IN_PROGRESS || status === TENANT_STATUS.CREATING) {
                return next(createHttpError(503, 'Tenant is being initialized. Please try again shortly.'));
            }
            if (status === TENANT_STATUS.SUSPENDED) {
                return next(createHttpError(403, 'Tenant account is SUSPENDED. Access denied.'));
            }
            
            return next(createHttpError(403, `Tenant account is ${status}. Access denied.`));
        }

        next();
    } catch (error) {
        console.error('❌ [TenantStatus] Middleware Error:', error.message);
        // Safety fallback: allow request but log failure to prevent site-wide outage if registry is unreachable
        next(); 
    }
};

module.exports = tenantStatusMiddleware;
