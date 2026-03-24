const createHttpError = require('http-errors');
const { logSecurityViolation } = require('../security/auditLogger');

// Safe absolute path resolution for tenantConnectionFactory
const path = require('path');
let tenantConnectionFactory;
try {
    const factoryPath = path.join(process.cwd(), 'src', 'services', 'tenantConnectionFactory');
    console.log('🔧 Loading tenant connection factory from:', factoryPath);
    tenantConnectionFactory = require(factoryPath);
    console.log('✅ Tenant connection factory loaded successfully');
} catch (error) {
    console.error('❌ Failed to load tenant connection factory:', error.message);
    tenantConnectionFactory = null;
}

/**
 * Model Injection Middleware
 * 
 * STRICT RULE: This is the ONLY way models can be injected into requests.
 * All controllers MUST use req.models to access models.
 * 
 * FORBIDDEN: Direct model imports anywhere else in the application.
 */
const modelInjectionMiddleware = async (req, res, next) => {
    try {
        if (req.path.includes('/admin/')) {
            return next();
        }

        const { businessId } = req;

        if (!businessId) {
            console.error('🚨 SECURITY VIOLATION: Model injection attempted without businessId:', req.path);
            
            await logSecurityViolation({
                userId: req.auth?.id,
                email: req.auth?.email,
                action: 'UNAUTHORIZED_MODEL_INJECTION',
                violation: 'Model injection attempted without businessId',
                severity: 'HIGH',
                ip: req.ip,
                path: req.path
            });
            
            return next(createHttpError(403, 'Business context required'));
        }

        try {
            if (!tenantConnectionFactory) {
                throw createHttpError(503, 'Tenant connection factory not initialized');
            }

            console.log(`🔧 Starting model injection for business ${businessId}`);
            
            // Enhanced fail-safe checks
            let injectionAttempts = 0;
            const maxAttempts = 2;
            
            while (injectionAttempts < maxAttempts) {
                try {
                    await tenantConnectionFactory.injectModelsIntoRequest(req);
                    
                    // Verify injection was successful
                    if (!req.models || Object.keys(req.models).length === 0) {
                        throw new Error('Model injection returned empty models object');
                    }
                    
                    const criticalModels = ['User', 'Business', 'Product'];
                    const missingCritical = criticalModels.filter(name => !req.models[name]);
                    if (missingCritical.length > 0) {
                        throw new Error(`Critical models missing: ${missingCritical.join(', ')}`);
                    }
                    
                    console.log(`✅ Models successfully injected for business ${businessId} (attempt ${injectionAttempts + 1})`);
                    break; // Success, exit retry loop
                    
                } catch (injectionError) {
                    injectionAttempts++;
                    console.warn(`⚠️ Model injection attempt ${injectionAttempts} failed for business ${businessId}:`, injectionError.message);
                    
                    if (injectionAttempts >= maxAttempts) {
                        throw injectionError;
                    }
                    
                    // Clear caches and retry
                    console.log(`🔄 Clearing caches and retrying model injection for business ${businessId}`);
                    try {
                        await tenantConnectionFactory.clearCache();
                    } catch (clearError) {
                        console.warn(`⚠️ Failed to clear cache:`, clearError.message);
                    }
                    
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
        } catch (error) {
            console.error(`❌ Model injection error for business ${businessId}:`, {
                message: error.message,
                stack: error.stack,
                businessId,
                path: req.path,
                method: req.method
            });
            return next(createHttpError(500, `Model injection failed: ${error.message}`));
        }

        next();

    } catch (error) {
        console.error('🔥 Model injection middleware error:', error);
        next(error);
    }
};

/**
 * Model Validation Middleware
 * Ensures req.models is present and valid before controller execution
 */
const modelValidationMiddleware = (req, res, next) => {
    // Skip validation for admin routes
    if (req.path.includes('/admin/')) {
        return next();
    }
    
    // CRITICAL: Ensure models are present
    if (!req.models) {
        console.error('🚨 CRITICAL ERROR: req.models is missing in controller:', {
            path: req.path,
            method: req.method,
            businessId: req.businessId,
            tenant: req.tenant
        });
        
        return next(createHttpError(500, 'Models not properly injected - system configuration error'));
    }
    
    // Ensure models object is not empty
    if (Object.keys(req.models).length === 0) {
        console.error('🚨 CRITICAL ERROR: req.models is empty:', {
            path: req.path,
            method: req.method,
            businessId: req.businessId
        });
        
        return next(createHttpError(500, 'No models available - system configuration error'));
    }
    
    next();
};

module.exports = { 
    modelInjectionMiddleware,
    modelValidationMiddleware
};
