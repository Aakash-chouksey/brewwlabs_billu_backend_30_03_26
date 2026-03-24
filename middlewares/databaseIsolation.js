const createHttpError = require('http-errors');

/**
 * Database Isolation Middleware
 * Secondary security layer ensuring that every tenant-scoped request 
 * has a valid brandId attached by the context middleware.
 */
const databaseIsolationMiddleware = (req, res, next) => {
    // If it's a tenant route but businessId is missing, block it
    if (req.path.includes('/tenant/') && !req.businessId && req.user?.role !== 'SUPER_ADMIN') {
        return next(createHttpError(403, 'Tenant isolation violation: Access denied'));
    }
    
    // For SuperAdmins, ensure they have provided a target context via headers
    if (req.user?.role === 'SUPER_ADMIN' && !req.businessId && req.path.includes('/tenant/')) {
        return next(createHttpError(400, 'SuperAdmin context required: Provide x-business-id header'));
    }

    next();
};

const tenantDatabaseGuard = (req, res, next) => {
    if (!req.businessId) {
        return next(createHttpError(400, 'Business ID context is missing for this tenant operation'));
    }
    next();
};

const adminDatabaseGuard = (req, res, next) => {
    if (req.user?.role !== 'SUPER_ADMIN') {
        return next(createHttpError(403, 'Admin guard escalation prevented'));
    }
    next();
};

module.exports = {
    databaseIsolationMiddleware,
    adminDatabaseGuard,
    tenantDatabaseGuard
};
