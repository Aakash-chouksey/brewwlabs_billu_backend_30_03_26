/**
 * TENANT CONTEXT ENHANCER MIDDLEWARE
 * 
 * Extracts and validates tenant context from headers
 * Provides consistent UUID-based context for all controllers
 */

const { extractUUIDFromHeaders, isValidUUID, formatUUIDForDB } = require('../utils/uuidValidator');

/**
 * Middleware to enhance tenant context with UUID extraction and validation
 */
const tenantContextEnhancer = (req, res, next) => {
    try {
        // Extract UUIDs from headers with validation (optional)
        const brandId = extractUUIDFromHeaders(req.headers, 'x-brand-id');
        const tenantId = extractUUIDFromHeaders(req.headers, 'x-tenant-id');
        const outletId = extractUUIDFromHeaders(req.headers, 'x-outlet-id');
        const businessId = brandId; // Alias for consistency

        // Enhanced tenant context (make fields optional)
        req.context = {
            brandId: brandId || null,
            tenantId: tenantId || null,
            businessId: businessId || null,
            outletId: outletId || null,
            // Add any additional context needed
            extractedAt: new Date().toISOString()
        };

        // Backward compatibility - also set individual properties if available
        if (brandId) req.brandId = brandId;
        if (tenantId) req.tenantId = tenantId;
        if (businessId) req.businessId = businessId;
        if (outletId) req.outletId = outletId;

        console.log('🔐 Enhanced tenant context (flexible):', {
            brandId: req.brandId || 'from-auth',
            tenantId: req.tenantId || 'from-auth',
            outletId: req.outletId || 'from-auth',
            source: 'headers-or-auth'
        });

        next();
    } catch (error) {
        console.error('❌ Tenant context enhancement failed:', error.message);
        // Don't block the request - continue without enhancement
        next();
    }
};

module.exports = tenantContextEnhancer;
