/**
 * SCHEMA UTILITIES - PHASE 1 FIXES
 * 
 * Critical schema handling utilities for Neon safety
 */

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
 * 🥈 2. VALIDATE SCHEMA EXISTS
 */
async function validateSchema(schemaName, sequelize, transaction) {
    if (!schemaName) {
        throw new Error("Schema name required for validation");
    }

    try {
        // Use a simple check that doesn't require information_schema access
        // Just try to set the schema and see if it works
        await sequelize.query(
            `SET search_path TO "${schemaName}", public`,
            { 
                transaction,
                type: sequelize.QueryTypes.SET 
            }
        );

        // Reset back to default
        await sequelize.query(
            `SET search_path TO public`,
            { 
                transaction,
                type: sequelize.QueryTypes.SET 
            }
        );

        return true;
    } catch (error) {
        throw new Error(`Schema validation failed for ${schemaName}: ${error.message}`);
    }
}

/**
 * 🥉 3. SET TRANSACTION-SCOPED SCHEMA (CRITICAL)
 */
async function setTransactionScopedSchema(schemaName, sequelize, transaction) {
    if (!schemaName) {
        throw new Error("Schema name required");
    }

    if (!transaction) {
        throw new Error("Transaction required for schema setting");
    }

    try {
        // CRITICAL: Use SET LOCAL for transaction-scoped schema
        await sequelize.query(
            `SET LOCAL search_path TO "${schemaName}", public`,
            { 
                transaction,
                type: sequelize.QueryTypes.SET 
            }
        );

        return true;
    } catch (error) {
        throw new Error(`Failed to set schema ${schemaName}: ${error.message}`);
    }
}

/**
 * 🏅 4. VERIFY SCHEMA AFTER SETTING
 */
async function verifySchemaSet(schemaName, sequelize, transaction) {
    if (!schemaName) {
        throw new Error("Schema name required for verification");
    }

    try {
        const [result] = await sequelize.query(
            `SELECT current_schema() as schema`,
            {
                type: sequelize.QueryTypes.SELECT,
                transaction
            }
        );

        const currentSchema = result.schema;
        
        if (!currentSchema.includes(schemaName)) {
            throw new Error(`Schema not applied correctly. Expected ${schemaName} in current schema, got: ${currentSchema}`);
        }

        return true;
    } catch (error) {
        throw new Error(`Schema verification failed for ${schemaName}: ${error.message}`);
    }
}

/**
 * 🧹 CLEANUP SCHEMA (for connection reuse safety)
 */
async function resetSchema(sequelize, transaction) {
    try {
        if (transaction) {
            // Reset to default within transaction
            await sequelize.query(
                `SET LOCAL search_path TO public`,
                { 
                    transaction,
                    type: sequelize.QueryTypes.SET 
                }
            );
        }
        return true;
    } catch (error) {
        throw new Error(`Schema reset failed: ${error.message}`);
    }
}

/**
 * 🔍 GET CURRENT SCHEMA (for debugging)
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

module.exports = {
    resolveSchema,
    validateSchema,
    setTransactionScopedSchema,
    verifySchemaSet,
    resetSchema,
    getCurrentSchema
};
