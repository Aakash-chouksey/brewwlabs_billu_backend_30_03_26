/**
 * SAFE CONTROLLER WRAPPER
 * 
 * Multi-tenant safe wrapper that catches async errors and 
 * ensures consistent API response structure.
 * 
 * Features:
 * 1. Automatic try/catch -> next(error)
 * 2. Prevent unhandled rejections
 * 3. Standardized error logging
 */

const safeControllerWrapper = (fn) => {
    return async (req, res, next) => {
        try {
            return await fn(req, res, next);
        } catch (error) {
            console.error(`🔥 [SAFE-WRAPPER] Error in ${req.method} ${req.originalUrl}:`, {
                message: error.message,
                stack: error.stack,
                tenantId: req.tenantId || 'none'
            });
            next(error);
        }
    };
};

/**
 * Helper to wrap all methods in a controller object
 */
const wrapController = (controller) => {
    const wrapped = {};
    // Handle both object-based and class-based controllers
    const proto = Object.getPrototypeOf(controller);
    const keys = [...Object.keys(controller), ...Object.getOwnPropertyNames(proto)];
    
    const uniqueKeys = new Set(keys.filter(k => k !== 'constructor' && typeof controller[k] === 'function'));

    uniqueKeys.forEach(key => {
        wrapped[key] = safeControllerWrapper(controller[key].bind(controller));
    });
    
    return wrapped;
};

module.exports = {
    safeControllerWrapper,
    wrapController
};
