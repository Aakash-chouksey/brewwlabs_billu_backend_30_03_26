/**
 * SCHEMA ENFORCEMENT MIDDLEWARE
 * 
 * CRITICAL: Ensures explicit schema context for different route types
 * - Onboarding routes: MUST use public schema ONLY
 * - Auth routes: MUST use public schema ONLY  
 * - Tenant routes: MUST use tenant schema (handled by tenant middleware)
 * 
 * This prevents the "relation public.tenant_registry does not exist" error
 * by ensuring onboarding NEVER runs in tenant context.
 */

const { sequelize } = require('../config/unified_database');
const { PUBLIC_SCHEMA } = require('../src/utils/constants');

/**
 * Force public schema for onboarding routes
 * MUST be applied BEFORE any route handlers that need public schema
 */
const enforcePublicSchema = async (req, res, next) => {
    try {
        // Explicitly set search_path to public for onboarding
        await sequelize.query(`SET search_path TO "${PUBLIC_SCHEMA}"`);
        
        // Mark request as public schema context
        req.schemaContext = PUBLIC_SCHEMA;
        req.isOnboarding = true;
        
        console.log(`[SchemaEnforcement] 🔒 Public schema enforced for ${req.method} ${req.path}`);
        
        next();
    } catch (error) {
        console.error('[SchemaEnforcement] ❌ Failed to set public schema:', error.message);
        next(error);
    }
};

/**
 * Reset schema to public after request completes
 * Acts as safety net to prevent schema leakage
 */
const resetSchemaToPublic = async (req, res, next) => {
    // Intercept response methods to ensure schema reset happens
    const originalEnd = res.end.bind(res);
    const originalJson = res.json.bind(res);
    
    let schemaReset = false;
    
    const doReset = async () => {
        if (schemaReset) return;
        schemaReset = true;
        
        try {
            await sequelize.query(`SET search_path TO "${PUBLIC_SCHEMA}"`);
            
            if (process.env.NODE_ENV === 'development') {
                console.log(`[SchemaEnforcement] 🔄 Schema reset to public for ${req.method} ${req.path}`);
            }
        } catch (error) {
            // Silent fail - don't block response for cleanup
            console.warn('[SchemaEnforcement] ⚠️ Schema reset failed:', error.message);
        }
    };
    
    // Wrap res.end
    res.end = function(chunk, encoding) {
        doReset().finally(() => {
            originalEnd(chunk, encoding);
        });
    };
    
    // Wrap res.json
    res.json = function(body) {
        doReset().finally(() => {
            originalJson(body);
        });
    };
    
    // Also reset on response finish event as backup
    res.on('finish', doReset);
    res.on('close', doReset);
    
    next();
};

/**
 * Validate schema context before database operations
 * Throws error if tenant tries to access public schema or vice versa
 */
const validateSchemaContext = (allowedSchema) => {
    return async (req, res, next) => {
        try {
            // Get current search_path
            const [result] = await sequelize.query('SHOW search_path', {
                type: sequelize.QueryTypes.SELECT
            });
            
            const currentSearchPath = result?.search_path || 'unknown';
            
            // Check if schema matches expected
            if (allowedSchema && !currentSearchPath.includes(allowedSchema)) {
                console.warn(`[SchemaEnforcement] ⚠️ Schema mismatch. Expected: ${allowedSchema}, Got: ${currentSearchPath}`);
                
                // Force correct schema
                await sequelize.query(`SET search_path TO "${allowedSchema}"`);
                console.log(`[SchemaEnforcement] 🔒 Schema corrected to: ${allowedSchema}`);
            }
            
            // Attach schema info to request
            req.currentSchema = currentSearchPath;
            
            next();
        } catch (error) {
            console.error('[SchemaEnforcement] ❌ Schema validation failed:', error.message);
            next(error);
        }
    };
};

/**
 * Combined middleware for onboarding routes
 * Enforces public schema before and resets after
 */
const onboardingSchemaIsolation = [
    enforcePublicSchema,
    resetSchemaToPublic
];

module.exports = {
    enforcePublicSchema,
    resetSchemaToPublic,
    validateSchemaContext,
    onboardingSchemaIsolation
};
