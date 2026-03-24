const createHttpError = require('http-errors');
const unifiedModelManager = require('../services/unifiedModelManager');

/**
 * UNIFIED MODEL INJECTION MIDDLEWARE
 * 
 * Replaces per-tenant model injection with single global model system
 * Models are injected once and work with any tenant schema
 */
const unifiedModelInjectionMiddleware = async (req, res, next) => {
    try {
        // Skip model injection for Super Admin on admin routes (they use control plane)
        if (req.isSuperAdmin && req.path.includes('/admin/')) {
            console.log('🔓 SUPER ADMIN - skipping model injection for admin routes');
            return next();
        }

        // Inject models into request
        await unifiedModelManager.injectModelsIntoRequest(req);
        
        // Validate models are working
        await unifiedModelManager.validateModels(req);
        
        console.log(`✅ Model injection successful for tenant: ${req.tenantId || 'UNKNOWN'}`);
        next();

    } catch (error) {
        console.error('❌ Unified Model Injection Error:', error.message);
        
        if (error.message.includes('not initialized')) {
            return next(createHttpError(503, 'Model system not ready. Please try again.'));
        }
        
        if (error.message.includes('schema')) {
            return next(createHttpError(400, 'Tenant schema error. Please check tenant configuration.'));
        }
        
        next(createHttpError(500, 'Model injection failed'));
    }
};

/**
 * Model validation middleware
 * Ensures models are properly injected before route handlers
 */
const modelValidationMiddleware = async (req, res, next) => {
    try {
        // Skip for Super Admin on admin routes
        if (req.isSuperAdmin && req.path.includes('/admin/')) {
            return next();
        }

        // Validate models exist in request
        if (!req.models || !req.models.Business) {
            return next(createHttpError(500, 'Models not properly injected'));
        }

        // Validate sequelize instance
        if (!req.sequelize) {
            return next(createHttpError(500, 'Database connection not available'));
        }

        console.log(`✅ Model validation passed for: ${req.tenantId || 'SUPER_ADMIN'}`);
        next();

    } catch (error) {
        console.error('❌ Model validation error:', error.message);
        next(createHttpError(500, 'Model validation failed'));
    }
};

module.exports = {
    unifiedModelInjectionMiddleware,
    modelValidationMiddleware
};
