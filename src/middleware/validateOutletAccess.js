/**
 * OUTLET OWNERSHIP VALIDATION MIDDLEWARE
 * 
 * Ensures users can only access outlets they own
 * Enforces tenant isolation at outlet level
 */

const createHttpError = require("http-errors");
const { getTenantModelsOrThrow } = require("../db/getTenantModelsOrThrow");

/**
 * Validate outlet ownership for current user
 */
async function validateOutletOwnership(req, outletId) {
    // Get tenant models for current request
    const Models = getTenantModelsOrThrow(req);
    const { Outlet } = Models;
    
    if (!outletId) {
        return false; // No outlet ID provided
    }
    
    // Check if outlet exists and belongs to tenant
    const outlet = await Outlet.findByPk(outletId);
    if (!outlet) {
        return false;
    }
    
    // Check if user owns this outlet (for non-SuperAdmin)
    if (req.userRole !== 'SuperAdmin') {
        // User must have outlet in their outletIds array
        if (!req.user.outletIds || !req.user.outletIds.includes(outletId)) {
            return false;
        }
    }
    
    return true;
}

/**
 * Middleware to validate outlet ownership
 */
async function outletOwnershipMiddleware(req, res, next) {
    try {
        const { outletId } = req.params;
        
        if (!validateOutletOwnership(req, outletId)) {
            return next(createHttpError(403, "Access denied: Outlet not found or access not permitted"));
        }
        
        // Attach outlet to request for downstream use
        req.outlet = await Models.Outlet.findByPk(outletId);
        
        next();
    } catch (error) {
        next(error);
    }
}

module.exports = {
    validateOutletOwnership,
    outletOwnershipMiddleware
};
