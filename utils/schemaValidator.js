/**
 * Multi-Tenant Schema Validation Utility
 * 
 * Validates:
 * 1. Tenant tables exist in tenant schema (not public)
 * 2. Control plane tables exist in public schema
 * 3. No schema drift across tenants
 * 4. Required columns exist in each table
 */

const { CONTROL_PLANE, TENANT_SCHEMA_PREFIX } = require('../utils/constants');

/**
 * Get all tenant schemas from database
 */
async function getTenantSchemas(sequelize) {
    const schemas = await sequelize.query(
        `SELECT schema_name 
         FROM information_schema.schemata 
         WHERE schema_name LIKE '${TENANT_SCHEMA_PREFIX}%'
         ORDER BY schema_name`,
        { type: sequelize.QueryTypes.SELECT }
    );
    return schemas.map(s => s.schema_name);
}

/**
 * Get all tables in a schema
 */
async function getTablesInSchema(sequelize, schemaName) {
    const tables = await sequelize.query(
        `SELECT table_name 
         FROM information_schema.tables 
         WHERE table_schema = :schemaName
         AND table_type = 'BASE TABLE'`,
        {
            replacements: { schemaName },
            type: sequelize.QueryTypes.SELECT
        }
    );
    return tables.map(t => t.table_name);
}

/**
 * Get columns for a table in a schema
 */
async function getTableColumns(sequelize, schemaName, tableName) {
    const columns = await sequelize.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns 
         WHERE table_schema = :schemaName 
         AND table_name = :tableName`,
        {
            replacements: { schemaName, tableName },
            type: sequelize.QueryTypes.SELECT
        }
    );
    return columns;
}

/**
 * Validate tenant schema isolation
 */
async function validateTenantIsolation(sequelize) {
    const issues = [];
    
    // Check if tenant tables exist in public schema (BAD)
    const tenantTables = [
        'products', 'categories', 'inventory', 'inventory_transactions',
        'orders', 'order_items', 'customers', 'outlets'
    ];
    
    for (const table of tenantTables) {
        const existsInPublic = await sequelize.query(
            `SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = :tableName`,
            {
                replacements: { tableName: table },
                type: sequelize.QueryTypes.SELECT
            }
        );
        
        if (existsInPublic.length > 0) {
            issues.push({
                severity: 'CRITICAL',
                type: 'WRONG_SCHEMA',
                table,
                message: `Tenant table '${table}' found in public schema - VIOLATES ISOLATION`
            });
        }
    }
    
    return issues;
}

/**
 * Compare schema across tenants to detect drift
 */
async function detectSchemaDrift(sequelize) {
    const schemas = await getTenantSchemas(sequelize);
    const driftReport = {
        schemasCompared: schemas.length,
        driftDetected: false,
        differences: []
    };
    
    if (schemas.length < 2) {
        return driftReport;
    }
    
    // Use first schema as reference
    const referenceSchema = schemas[0];
    const referenceTables = await getTablesInSchema(sequelize, referenceSchema);
    
    for (let i = 1; i < schemas.length; i++) {
        const compareSchema = schemas[i];
        const compareTables = await getTablesInSchema(sequelize, compareSchema);
        
        // Check for missing tables
        const missingInCompare = referenceTables.filter(t => !compareTables.includes(t));
        const extraInCompare = compareTables.filter(t => !referenceTables.includes(t));
        
        if (missingInCompare.length > 0 || extraInCompare.length > 0) {
            driftReport.driftDetected = true;
            driftReport.differences.push({
                schema: compareSchema,
                missingTables: missingInCompare,
                extraTables: extraInCompare
            });
        }
        
        // Check column consistency for common tables
        for (const table of referenceTables.filter(t => compareTables.includes(t))) {
            const refColumns = await getTableColumns(sequelize, referenceSchema, table);
            const compColumns = await getTableColumns(sequelize, compareSchema, table);
            
            const refColNames = refColumns.map(c => c.column_name);
            const compColNames = compColumns.map(c => c.column_name);
            
            const missingCols = refColNames.filter(c => !compColNames.includes(c));
            
            if (missingCols.length > 0) {
                driftReport.driftDetected = true;
                driftReport.differences.push({
                    schema: compareSchema,
                    table,
                    missingColumns: missingCols
                });
            }
        }
    }
    
    return driftReport;
}

/**
 * Validate specific tenant has all required tables
 */
async function validateTenantSchemaComplete(sequelize, tenantId) {
    const schemaName = `${TENANT_SCHEMA_PREFIX}${tenantId}`;
    const requiredTables = [
        'products', 'categories', 'inventory', 'inventory_transactions',
        'orders', 'order_items', 'customers', 'outlets', 'tables', 'areas'
    ];
    
    const existingTables = await getTablesInSchema(sequelize, schemaName);
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    
    return {
        schema: schemaName,
        complete: missingTables.length === 0,
        missingTables,
        existingTables
    };
}

/**
 * Main validation function - use this to validate multi-tenant setup
 */
async function validateMultiTenantSetup(sequelize) {
    console.log('[SchemaValidator] Starting multi-tenant validation...');
    
    const startTime = Date.now();
    
    const [isolationIssues, driftReport] = await Promise.all([
        validateTenantIsolation(sequelize),
        detectSchemaDrift(sequelize)
    ]);
    
    const report = {
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
        isolation: {
            valid: isolationIssues.length === 0,
            issues: isolationIssues
        },
        drift: driftReport,
        recommendations: []
    };
    
    // Generate recommendations
    if (isolationIssues.length > 0) {
        report.recommendations.push(
            'CRITICAL: Move tenant tables from public schema to tenant schemas immediately'
        );
    }
    
    if (driftReport.driftDetected) {
        report.recommendations.push(
            'Run migration scripts to bring all tenant schemas to consistent state'
        );
    }
    
    console.log(`[SchemaValidator] Validation complete in ${report.executionTimeMs}ms`);
    console.log(`[SchemaValidator] Isolation valid: ${report.isolation.valid}`);
    console.log(`[SchemaValidator] Schema drift detected: ${driftReport.driftDetected}`);
    
    return report;
}

module.exports = {
    validateMultiTenantSetup,
    validateTenantSchemaComplete,
    detectSchemaDrift,
    validateTenantIsolation,
    getTenantSchemas,
    getTablesInSchema,
    getTableColumns
};
