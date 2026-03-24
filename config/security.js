/**
 * Multi-Tenant Security Configuration
 * This file provides centralized security configuration for strict tenant isolation
 */

const { tenantRateLimit } = require('../middlewares/tenantRateLimitMiddleware');
const { tenantMiddleware, authorize, requireTenantFilter } = require('../middlewares/tenantMiddleware');
const { autoTenantFilter } = require('../utils/tenantFilter');

/**
 * Security middleware stack for different types of routes
 */
const securityMiddleware = {
    /**
     * Base security stack - applies to all authenticated routes
     */
    base: [
        tenantMiddleware,       // Tenant context extraction and validation
    ],

    /**
     * Standard API security - for regular operations
     */
    standard: [
        tenantMiddleware,
        tenantRateLimit('api'), // Standard rate limiting per tenant
    ],

    /**
     * Strict security - for sensitive operations (create, update, delete)
     */
    strict: [
        tenantMiddleware,
        tenantRateLimit('strict'), // Stricter rate limiting
    ],

    /**
     * Authentication security - for login/register operations
     */
    auth: [
        tenantRateLimit('auth'), // Very strict rate limiting for auth
    ],

    /**
     * File upload security - for upload operations
     */
    upload: [
        tenantMiddleware,
        tenantRateLimit('uploads'), // Upload-specific rate limiting
    ],

    /**
     * Order processing security - for high-frequency order operations
     */
    orders: [
        tenantMiddleware,
        tenantRateLimit('orders'), // High-frequency rate limiting
    ],

    /**
     * Auto tenant filtering - automatically applies tenant filtering to all DB operations
     * Use with caution - only for routes that exclusively use tenant data
     */
    autoFilter: [
        tenantMiddleware,
        autoTenantFilter(), // Automatic tenant filtering for all model operations
    ]
};

/**
 * Role-based authorization helpers
 */
const roles = {
    SUPER_ADMIN: ['SuperAdmin'],
    BUSINESS_ADMIN: ['BusinessAdmin', 'SuperAdmin'],
    MANAGER_PLUS: ['Manager', 'BusinessAdmin', 'SuperAdmin'],
    STAFF_PLUS: ['Cashier', 'Waiter', 'Manager', 'BusinessAdmin', 'SuperAdmin'],
    ALL_ROLES: ['SuperAdmin', 'BusinessAdmin', 'SubAdmin', 'Manager', 'Cashier', 'Waiter']
};

/**
 * Security configuration for different route types
 */
const routeSecurity = {
    // Public routes (no authentication required)
    public: [],

    // Authentication routes
    auth: securityMiddleware.auth,

    // Standard read operations
    read: [
        ...securityMiddleware.standard,
        requireTenantFilter
    ],

    // Write operations (create, update, delete)
    write: [
        ...securityMiddleware.strict,
        requireTenantFilter
    ],

    // Sensitive operations
    sensitive: [
        ...securityMiddleware.strict,
        requireTenantFilter
    ],

    // File operations
    file: [
        ...securityMiddleware.upload,
        requireTenantFilter
    ],

    // Order operations
    order: [
        ...securityMiddleware.orders,
        requireTenantFilter
    ]
};

/**
 * Middleware factory for creating secure routes
 */
const createSecureRoute = (type = 'standard', options = {}) => {
    const { 
        allowedRoles = [], 
        customMiddleware = [],
        skipTenantFilter = false 
    } = options;

    const middleware = [...(routeSecurity[type] || securityMiddleware.base)];

    // Add role-based authorization if specified
    if (allowedRoles.length > 0) {
        middleware.push(authorize(allowedRoles));
    }

    // Add tenant filtering unless explicitly skipped
    if (!skipTenantFilter && type !== 'public' && type !== 'auth') {
        middleware.push(requireTenantFilter);
    }

    // Add any custom middleware
    middleware.push(...customMiddleware);

    return middleware;
};

/**
 * Security validation helpers
 */
const validation = {
    /**
     * Validate that a request has proper tenant context
     */
    hasTenantContext: (req) => {
        return req.businessId && req.userRole;
    },

    /**
     * Validate that user can access the specified business
     */
    canAccessBusiness: (req, businessId) => {
        if (req.userRole === 'SuperAdmin') return true;
        return req.businessId === businessId;
    },

    /**
     * Validate that user can access the specified outlet
     */
    canAccessOutlet: (req, outletId) => {
        if (req.userRole === 'SuperAdmin') return true;
        
        // Check if outlet belongs to user's business
        // This would require a database lookup for full validation
        return req.outletId === outletId || !req.outletId;
    },

    /**
     * Check if user has sufficient role for operation
     */
    hasRole: (req, requiredRoles) => {
        if (!Array.isArray(requiredRoles)) {
            requiredRoles = [requiredRoles];
        }
        return requiredRoles.includes(req.userRole);
    }
};

/**
 * Security headers for enhanced protection
 */
const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'",
    'Referrer-Policy': 'strict-origin-when-cross-origin'
};

/**
 * Apply security headers to response
 */
const applySecurityHeaders = (req, res, next) => {
    Object.entries(securityHeaders).forEach(([header, value]) => {
        res.setHeader(header, value);
    });
    next();
};

module.exports = {
    securityMiddleware,
    roles,
    routeSecurity,
    createSecureRoute,
    validation,
    securityHeaders,
    applySecurityHeaders,
    // Export individual middleware for direct use
    tenantMiddleware,
    authorize,
    requireTenantFilter,
    tenantRateLimit,
    autoTenantFilter
};
