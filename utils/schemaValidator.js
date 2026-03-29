/**
 * Multi-Tenant Schema Validation Utility
 * 
 * Validates:
 * 1. Tenant tables exist in tenant schema (not public)
 * 2. Control plane tables exist in public schema
 * 3. No schema drift across tenants
 * 4. Required columns exist in each table
 */

const { CONTROL_PLANE, TENANT_SCHEMA_PREFIX } = require('../src/utils/constants');

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
 * Validate specific tenant has all required tables AND required columns
 */
async function validateTenantSchemaComplete(sequelize, businessId) {
    const schemaName = `${TENANT_SCHEMA_PREFIX}${businessId}`;
    const { TENANT_MODELS } = require('../src/utils/constants');
    
    // Map model names to table names (standard Sequelize convention or explicitly specified)
    // Most follow the snake_case plural pattern
    const modelToTable = (modelName) => {
        if (modelName === 'Category') return 'categories';
        if (modelName === 'Product') return 'products';
        if (modelName === 'Order') return 'orders';
        if (modelName === 'OrderItem') return 'order_items';
        if (modelName === 'InventoryItem') return 'inventory_items';
        if (modelName === 'InventoryTransaction') return 'inventory_transactions';
        if (modelName === 'BillingConfig') return 'billing_configs';
        if (modelName === 'CustomerLedger') return 'customer_ledger';
        if (modelName === 'CustomerTransaction') return 'customer_transactions';
        if (modelName === 'ExpenseType') return 'expense_types';
        if (modelName === 'FeatureFlag') return 'feature_flags';
        if (modelName === 'InventoryCategory') return 'inventory_categories';
        if (modelName === 'MembershipPlan') return 'membership_plans';
        if (modelName === 'OperationTiming') return 'operation_timings';
        if (modelName === 'PartnerMembership') return 'partner_memberships';
        if (modelName === 'PartnerType') return 'partner_types';
        if (modelName === 'PartnerWallet') return 'partner_wallets';
        if (modelName === 'ProductType') return 'product_types';
        if (modelName === 'PurchaseItem') return 'purchase_items';
        if (modelName === 'RecipeItem') return 'recipe_items';
        if (modelName === 'RollTracking') return 'roll_trackings';
        if (modelName === 'SchemaVersion') return 'schema_versions';
        if (modelName === 'StockTransaction') return 'stock_transactions';
        if (modelName === 'TenantAuditLog') return 'audit_logs';
        if (modelName === 'AccountTransaction') return 'account_transactions';
        if (modelName === 'WebContent') return 'web_contents';
        if (modelName === 'Area') return 'table_areas';
        if (modelName === 'Inventory') return 'inventory';
        
        // Default to plural snake_case
        return modelName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '') + 's';
    };

    const requiredTables = TENANT_MODELS.map(modelToTable);
    
    // Define CRITICAL columns that MUST exist
    const systemColumns = ['id', 'business_id', 'created_at', 'updated_at'];
    const outletScopedTables = [
        'products', 'orders', 'inventory', 'inventory_items', 'categories', 
        'tables', 'table_areas', 'order_items', 'payments', 'expenses', 
        'incomes', 'purchases'
    ];
    const skuTables = ['products', 'inventory_items'];

    const existingTables = await getTablesInSchema(sequelize, schemaName);
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    
    const columnIssues = [];
    for (const table of existingTables) {
        // Skip table if not in our required list (though they should all be there)
        if (!requiredTables.includes(table)) continue;
        
        const columns = await getTableColumns(sequelize, schemaName, table);
        const columnNames = columns.map(c => c.column_name);
        
        const missingCols = [];
        
        // Check system columns
        for (const col of systemColumns) {
            if (!columnNames.includes(col)) missingCols.push(col);
        }
        
        // Check outlet_id for scoped tables
        if (outletScopedTables.includes(table) && !columnNames.includes('outlet_id')) {
            missingCols.push('outlet_id');
        }
        
        // Check sku for relevant tables
        if (skuTables.includes(table) && !columnNames.includes('sku')) {
            missingCols.push('sku');
        }
        
        if (missingCols.length > 0) {
            columnIssues.push({ table, missingColumns: missingCols });
        }
    }
    
    // Also check for schema_versions specifically
    if (existingTables.includes('schema_versions')) {
        const columns = await getTableColumns(sequelize, schemaName, 'schema_versions');
        const columnNames = columns.map(c => c.column_name);
        if (!columnNames.includes('version')) {
            columnIssues.push({ table: 'schema_versions', missingColumns: ['version'] });
        }
    }
    
    return {
        schema: schemaName,
        complete: missingTables.length === 0 && columnIssues.length === 0,
        missingTables,
        columnIssues,
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

/**
 * Validate before tenant activation - comprehensive pre-activation check
 */
async function validateBeforeActivation(sequelize, schemaName, tenantModels) {
    console.log(`[SchemaValidator] 🛡️ Pre-activation validation for ${schemaName}`);

    const checks = {
        schemaValid: false,
        requiredDataPresent: false,
        canActivate: false,
        details: {}
    };

    // 1. Schema structure validation
    const schemaValidation = await validateTenantSchemaComplete(sequelize, schemaName.replace('tenant_', ''));
    checks.schemaValid = schemaValidation.complete;
    checks.details.schema = schemaValidation;

    // 2. Required data validation (using models)
    try {
        const dataChecks = await validateRequiredData(tenantModels);
        checks.requiredDataPresent = dataChecks.valid;
        checks.details.data = dataChecks;
    } catch (error) {
        checks.details.data = { valid: false, error: error.message };
    }

    // 3. Final decision
    checks.canActivate = checks.schemaValid && checks.requiredDataPresent;

    console.log(`[SchemaValidator] 🛡️ Pre-activation result: ${checks.canActivate ? 'CAN ACTIVATE' : 'CANNOT ACTIVATE'}`);
    return checks;
}

/**
 * Validate required data exists
 */
async function validateRequiredData(tenantModels) {
    const checks = {
        valid: true,
        categories: false,
        settings: false,
        outlet: false,
        errors: []
    };

    try {
        // Check categories (at least 1 required)
        if (tenantModels.Category) {
            const catCount = await tenantModels.Category.count();
            checks.categories = catCount >= 1;
            if (!checks.categories) checks.errors.push('At least 1 category required');
        }

        // Check settings (at least 1 required)
        if (tenantModels.Setting) {
            const settingCount = await tenantModels.Setting.count();
            checks.settings = settingCount >= 1;
            if (!checks.settings) checks.errors.push('Settings record required');
        }

        // Check outlet (at least 1 required)
        if (tenantModels.Outlet) {
            const outletCount = await tenantModels.Outlet.count();
            checks.outlet = outletCount >= 1;
            if (!checks.outlet) checks.errors.push('At least 1 outlet required');
        }

        checks.valid = checks.categories && checks.settings && checks.outlet;

    } catch (error) {
        checks.valid = false;
        checks.errors.push(`Data validation error: ${error.message}`);
    }

    return checks;
}

module.exports = {
    validateMultiTenantSetup,
    validateTenantSchemaComplete,
    detectSchemaDrift,
    validateTenantIsolation,
    getTenantSchemas,
    getTablesInSchema,
    getTableColumns,
    validateBeforeActivation,
    validateRequiredData
};
