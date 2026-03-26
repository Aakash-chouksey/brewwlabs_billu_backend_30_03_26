/**
 * SCHEMA UTILITIES - PRODUCTION-GRADE SCHEMA ENFORCEMENT
 * 
 * Critical schema handling utilities for strict tenant isolation
 * 🔒 NO search_path usage - Uses explicit schema binding only
 */

const { enforceSchema, securityCheck } = require('../utils/schemaEnforcement');

/**
 * 🥇 1. FIX SCHEMA NAME RESOLUTION
 */
function resolveSchema(tenantId) {
    if (!tenantId) {
        throw new Error("Tenant ID required for schema resolution");
    }

    // Handle different tenant ID formats
    if (tenantId.startsWith("tenant_")) {
        return tenantId; // Already in correct format
    } else if (tenantId.startsWith("tenant-")) {
        return tenantId.replace("tenant-", "tenant_"); // Convert dash to underscore
    } else {
        return `tenant_${tenantId}`; // Add prefix
    }
}

/**
 * 🥈 2. VALIDATE SCHEMA EXISTS (NO search_path - uses information_schema)
 */
async function validateSchema(schemaName, sequelize, transaction) {
    if (!schemaName) {
        throw new Error("Schema name required for validation");
    }

    // 🔒 Enforce schema before validation
    enforceSchema(schemaName);

    try {
        // Use information_schema query instead of SET search_path
        const [result] = await sequelize.query(
            `SELECT schema_name 
             FROM information_schema.schemata 
             WHERE schema_name = :schemaName`,
            { 
                replacements: { schemaName },
                transaction,
                type: sequelize.QueryTypes.SELECT 
            }
        );

        if (!result) {
            throw new Error(`Schema '${schemaName}' does not exist`);
        }

        return true;
    } catch (error) {
        throw new Error(`Schema validation failed for ${schemaName}: ${error.message}`);
    }
}

/**
 * 🥉 3. GET TABLES IN SCHEMA (NO search_path)
 */
async function getSchemaTables(schemaName, sequelize, transaction) {
    if (!schemaName) {
        throw new Error("Schema name required");
    }

    // 🔒 Enforce schema
    enforceSchema(schemaName);

    try {
        const tables = await sequelize.query(
            `SELECT table_name 
             FROM information_schema.tables 
             WHERE table_schema = :schemaName
             AND table_type = 'BASE TABLE'`,
            { 
                replacements: { schemaName },
                transaction,
                type: sequelize.QueryTypes.SELECT 
            }
        );

        return tables.map(t => t.table_name);
    } catch (error) {
        throw new Error(`Failed to get tables for schema ${schemaName}: ${error.message}`);
    }
}

/**
 * 🏅 4. VERIFY SCHEMA AFTER INITIALIZATION
 */
async function verifySchemaSet(schemaName, sequelize, transaction) {
    if (!schemaName) {
        throw new Error("Schema name required for verification");
    }

    // 🔒 Enforce schema
    enforceSchema(schemaName);

    try {
        // Check schema exists in information_schema
        const [result] = await sequelize.query(
            `SELECT schema_name 
             FROM information_schema.schemata 
             WHERE schema_name = :schemaName`,
            {
                replacements: { schemaName },
                type: sequelize.QueryTypes.SELECT,
                transaction
            }
        );

        if (!result) {
            throw new Error(`Schema verification failed: ${schemaName} not found in information_schema.schemata`);
        }

        // Check critical tables exist
        const requiredTables = ['outlets', 'products', 'orders', 'categories'];
        const tables = await getSchemaTables(schemaName, sequelize, transaction);
        
        const missing = requiredTables.filter(t => !tables.includes(t));
        if (missing.length > 0) {
            throw new Error(`Schema ${schemaName} missing required tables: ${missing.join(', ')}`);
        }

        return true;
    } catch (error) {
        throw new Error(`Schema verification failed for ${schemaName}: ${error.message}`);
    }
}

/**
 * 🧹 CHECK SCHEMA IS VALID (replacement for resetSchema)
 */
async function checkSchemaValid(schemaName, sequelize, transaction) {
    try {
        return await validateSchema(schemaName, sequelize, transaction);
    } catch (error) {
        console.warn(`Schema check failed for ${schemaName}:`, error.message);
        return false;
    }
}

/**
 * 🔍 GET CURRENT SCHEMA (for debugging - uses information_schema)
 */
async function getCurrentSchema(sequelize, transaction) {
    try {
        const [result] = await sequelize.query(
            `SELECT current_schema() as schema`,
            {
                type: sequelize.QueryTypes.SELECT,
                transaction
            }
        );

        return result.schema;
    } catch (error) {
        throw new Error(`Failed to get current schema: ${error.message}`);
    }
}

/**
 * 🔒 VALIDATE TENANT ACCESS
 */
function validateTenantAccess(tenantId, schemaName, operation) {
    securityCheck(schemaName, tenantId, operation);
    return true;
}

module.exports = {
    resolveSchema,
    validateSchema,
    getSchemaTables,
    verifySchemaSet,
    checkSchemaValid,
    getCurrentSchema,
    validateTenantAccess
};
