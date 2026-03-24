/**
 * TENANT ROUTING MIDDLEWARE
 * Legacy compatibility middleware - replaced by neonSafeTenantMiddleware in production
 */

/**
 * Legacy tenant routing middleware
 * This is a compatibility shim for routes that still reference tenantRouting
 */
exports.tenantRoutingMiddleware = async (req, res, next) => {
    // In the Neon-safe architecture, tenant context is set by neonSafeTenantMiddleware
    // This middleware acts as a pass-through for backwards compatibility
    if (!req.businessId && req.auth?.businessId) {
        req.businessId = req.auth.businessId;
    }
    if (!req.outletId && req.auth?.outletId) {
        req.outletId = req.auth.outletId;
    }
    next();
};

/**
 * Legacy database guard - replaced by proper isolation in Neon-safe architecture
 */
exports.tenantDatabaseGuard = async (req, res, next) => {
    // Pass-through for compatibility - actual isolation is handled by neonSafeModelInjection
    next();
};
