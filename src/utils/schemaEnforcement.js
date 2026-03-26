/**
 * SCHEMA ENFORCEMENT UTILITY
 * 
 * Production-critical: Enforces strict tenant schema usage
 * NEVER allows public schema for tenant operations
 */

const { CONTROL_PLANE, PUBLIC_SCHEMA, TENANT_SCHEMA_PREFIX } = require('./constants');

/**
 * Enforce valid schema - BLOCKS public schema for tenant operations
 * @param {string} schemaName - Schema name to validate
 * @param {string} tenantId - Tenant ID for context
 * @throws {Error} If schema is invalid or public for non-control-plane
 */
function enforceSchema(schemaName, tenantId = null) {
    if (!schemaName) {
        throw new Error("🚨 INVALID SCHEMA USAGE: schemaName is required");
    }
    
    // Allow public schema ONLY for control plane operations
    if (schemaName === PUBLIC_SCHEMA && tenantId !== CONTROL_PLANE) {
        throw new Error(`🚨 SECURITY VIOLATION: Tenant '${tenantId}' cannot use public schema. Only '${CONTROL_PLANE}' may use public schema.`);
    }
    
    // Validate tenant schema format
    if (tenantId && tenantId !== CONTROL_PLANE) {
        const expectedSchema = `${TENANT_SCHEMA_PREFIX}${tenantId}`;
        if (schemaName !== expectedSchema) {
            throw new Error(`🚨 SCHEMA MISMATCH: Expected '${expectedSchema}' but got '${schemaName}'`);
        }
    }
    
    return true;
}

/**
 * Get tenant model with strict schema validation
 * @param {Object} model - Sequelize model
 * @param {string} schemaName - Schema name
 * @param {string} tenantId - Tenant ID
 * @returns {Object} Schema-bound model
 * @throws {Error} If schema is invalid
 */
function getTenantModel(model, schemaName, tenantId = null) {
    // Enforce schema validation first
    enforceSchema(schemaName, tenantId);
    
    if (!model) {
        throw new Error("🚨 INVALID MODEL: Model is required");
    }
    
    // Bind model to schema
    return model.schema(schemaName);
}

/**
 * Validate tenant schema exists and has required tables
 * @param {Object} sequelize - Sequelize instance
 * @param {string} schemaName - Schema name to validate
 * @param {Array<string>} requiredTables - Required table names
 * @returns {Promise<Object>} Validation result
 */
async function validateTenantSchema(sequelize, schemaName, requiredTables = ['outlets', 'products', 'orders', 'categories']) {
    // Enforce schema first
    enforceSchema(schemaName);
    
    try {
        // Check schema exists
        const schemaResult = await sequelize.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name = :schema
        `, {
            replacements: { schema: schemaName },
            type: sequelize.QueryTypes.SELECT
        });
        
        if (!schemaResult.length) {
            throw new Error(`🚨 SCHEMA NOT FOUND: '${schemaName}' does not exist`);
        }
        
        // Check required tables
        const tables = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = :schema
            AND table_type = 'BASE TABLE'
        `, {
            replacements: { schema: schemaName },
            type: sequelize.QueryTypes.SELECT
        });
        
        const existingTables = tables.map(t => t.table_name);
        const missingTables = requiredTables.filter(t => !existingTables.includes(t));
        
        if (missingTables.length > 0) {
            throw new Error(`🚨 MISSING TABLES in '${schemaName}': ${missingTables.join(', ')}`);
        }
        
        return {
            valid: true,
            schema: schemaName,
            tables: existingTables,
            tableCount: existingTables.length
        };
    } catch (error) {
        if (error.message.startsWith('🚨')) {
            throw error;
        }
        throw new Error(`🚨 SCHEMA VALIDATION FAILED: ${error.message}`);
    }
}

/**
 * Security check for public schema access
 * @param {string} schemaName - Schema being accessed
 * @param {string} tenantId - Tenant ID
 * @param {string} operation - Operation description for logging
 * @throws {Error} If unauthorized public schema access
 */
function securityCheck(schemaName, tenantId, operation = 'operation') {
    if (schemaName === PUBLIC_SCHEMA && tenantId !== CONTROL_PLANE) {
        const error = new Error(
            `🚨 SECURITY VIOLATION: Tenant '${tenantId}' attempted unauthorized ${operation} on public schema. ` +
            `Only '${CONTROL_PLANE}' may access public schema.`
        );
        console.error(error.message);
        throw error;
    }
    return true;
}

/**
 * Assert that the connection's search_path matches expected execution context
 * CRITICAL safety net for Neon/PgBouncer connection pooling
 */
async function assertSchemaContext(sequelize, expectedSchema, options = {}) {
    // Skip expensive SHOW search_path query unless explicitly enabled
    // This query is redundant with schema-bound models and adds ~50-100ms per request on cloud DBs
    if (process.env.STRICT_SCHEMA_ASSERTIONS !== 'true') return;
    
    try {
        const [result] = await sequelize.query('SHOW search_path', {
            type: sequelize.QueryTypes.SELECT,
            transaction: options.transaction,
            logging: false
        });
        
        const currentPath = result?.search_path || 'unknown';
        
        // If we expect a tenant schema, the search_path should NOT be just 'public'
        // Note: Neon/Sequelize sometimes adds "$user" or other suffixes
        if (expectedSchema !== PUBLIC_SCHEMA && currentPath.includes(PUBLIC_SCHEMA) && !currentPath.includes(expectedSchema)) {
            // This is a warning sign that search_path might be leaked from a previous request
            // However, since we use schema-bound models, this is a "soft" guard
            if (process.env.STRICT_SCHEMA_ENFORCEMENT === 'true') {
                 throw new Error(`🚨 SCHEMA CONTEXT LEAK: Expected context '${expectedSchema}' but found '${currentPath}'`);
            }
        }
    } catch (error) {
        if (error.message.startsWith('🚨')) throw error;
        // Silent fail for non-critical query errors to prevent blocking
        console.warn(`[SchemaEnforcement] ⚠️ Context assertion skipped: ${error.message}`);
    }
}

module.exports = {
    enforceSchema,
    getTenantModel,
    validateTenantSchema,
    securityCheck,
    assertSchemaContext,
    CONTROL_PLANE,
    PUBLIC_SCHEMA,
    TENANT_SCHEMA_PREFIX
};
