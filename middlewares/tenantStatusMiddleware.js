const createHttpError = require('http-errors');
// OPTIMIZATION: Direct model import for fast queries (no executor overhead)
const { sequelize } = require('../config/unified_database');
const { CONTROL_PLANE } = require('../src/utils/constants');

// Local cache to prevent DB hammering on every request
const statusCache = new Map();
const CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Tenant Status Middleware
 * Blocks access for suspended or inactive tenants
 * OPTIMIZED: Uses direct model queries without executor overhead
 */
const tenantStatusMiddleware = async (req, res, next) => {
    try {
        const businessId = req.businessId;
        
        // Skip if not a tenant-scoped request or if it's already a SuperAdmin bypassed route
        if (!businessId || req.user?.role === 'SUPER_ADMIN') {
            return next();
        }

        const now = Date.now();
        const cached = statusCache.get(businessId);

        if (cached && (now - cached.timestamp < CACHE_TTL)) {
            if (cached.status !== 'active') {
                return next(createHttpError(403, `Tenant account is ${cached.status}. Access denied.`));
            }
            return next();
        }

        // OPTIMIZATION: Use direct model query without executor overhead
        const TenantRegistry = sequelize.models.TenantRegistry.schema('public');
        
        const registry = await TenantRegistry.findOne({
            where: { businessId },
            attributes: ['status']
        });

        if (!registry) {
            console.warn(`⚠️  Tenant ${businessId} not found in Registry. Blocking for safety.`);
            return next(createHttpError(403, 'Tenant registration not found. Access denied.'));
        }

        const status = registry.status;
        
        // Update cache
        statusCache.set(businessId, {
            status,
            timestamp: now
        });

        if (status !== 'active') {
            return next(createHttpError(403, `Tenant account is ${status}. Access denied.`));
        }

        next();
    } catch (error) {
        console.error('❌ Tenant status check failed:', error.message);
        // Fallback: allow request but log error to prevent site-wide outage if registry is down
        next(); 
    }
};

module.exports = tenantStatusMiddleware;
