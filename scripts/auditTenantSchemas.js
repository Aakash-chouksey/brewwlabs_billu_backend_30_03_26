/**
 * =====================================================
 * COMPREHENSIVE TENANT SCHEMA AUDIT SCRIPT
 * =====================================================
 * 
 * This script audits all tenant schemas and identifies:
 * 1. Missing tables compared to Sequelize models
 * 2. Missing columns in existing tables
 * 3. Schema drift between tenants
 * 4. Issues with the migration system
 * 
 * Run with: node scripts/auditTenantSchemas.js
 */

const { sequelize } = require('../config/unified_database');
const { TENANT_SCHEMA_PREFIX, TENANT_MODELS } = require('../src/utils/constants');

// Map model names to expected table names
const MODEL_TO_TABLE = {
    'Account': 'accounts',
    'AccountTransaction': 'account_transactions',
    'Area': 'table_areas',
    'BillingConfig': 'billing_configs',
    'Category': 'categories',
    'Customer': 'customers',
    'CustomerLedger': 'customer_ledger',
    'CustomerTransaction': 'customer_transactions',
    'Expense': 'expenses',
    'ExpenseType': 'expense_types',
    'FeatureFlag': 'feature_flags',
    'Income': 'incomes',
    'Inventory': 'inventory',
    'InventoryCategory': 'inventory_categories',
    'InventoryItem': 'inventory_items',
    'InventorySale': 'inventory_sales',
    'InventoryTransaction': 'inventory_transactions',
    'MembershipPlan': 'membership_plans',
    'OperationTiming': 'operation_timings',
    'Order': 'orders',
    'OrderItem': 'order_items',
    'Outlet': 'outlets',
    'PartnerMembership': 'partner_memberships',
    'PartnerType': 'partner_types',
    'PartnerWallet': 'partner_wallets',
    'Payment': 'payments',
    'Product': 'products',
    'ProductType': 'product_types',
    'Purchase': 'purchases',
    'PurchaseItem': 'purchase_items',
    'Recipe': 'recipes',
    'RecipeItem': 'recipe_items',
    'RollTracking': 'roll_trackings',
    'SchemaVersion': 'schema_versions',
    'Setting': 'settings',
    'StockTransaction': 'stock_transactions',
    'Supplier': 'suppliers',
    'Table': 'tables',
    'TenantAuditLog': 'audit_logs',
    'Timing': 'timings',
    'Wastage': 'wastages',
    'WebContent': 'web_contents'
};

// Critical columns that must exist in each table
const SYSTEM_COLUMNS = ['id', 'business_id', 'created_at', 'updated_at'];

// Table-specific required columns
const TABLE_REQUIRED_COLUMNS = {
    'product_types': ['id', 'business_id', 'outlet_id', 'name', 'status', 'created_at', 'updated_at'],
    'products': ['id', 'business_id', 'outlet_id', 'category_id', 'name', 'price', 'is_active', 'created_at', 'updated_at'],
    'categories': ['id', 'business_id', 'outlet_id', 'name', 'is_enabled', 'created_at', 'updated_at'],
    'orders': ['id', 'business_id', 'outlet_id', 'order_number', 'status', 'billing_total', 'created_at', 'updated_at'],
    'tables': ['id', 'business_id', 'outlet_id', 'table_no', 'name', 'capacity', 'status', 'created_at', 'updated_at'],
    'outlets': ['id', 'business_id', 'name', 'status', 'is_active', 'created_at', 'updated_at'],
    'inventory_items': ['id', 'business_id', 'outlet_id', 'name', 'sku', 'current_stock', 'created_at', 'updated_at'],
    'customers': ['id', 'business_id', 'outlet_id', 'name', 'phone', 'is_active', 'created_at', 'updated_at']
};

async function getTenantSchemas() {
    const schemas = await sequelize.query(
        `SELECT schema_name 
         FROM information_schema.schemata 
         WHERE schema_name LIKE '${TENANT_SCHEMA_PREFIX}%'
         ORDER BY schema_name`,
        { type: sequelize.QueryTypes.SELECT }
    );
    return schemas.map(s => s.schema_name);
}

async function getTablesInSchema(schemaName) {
    const tables = await sequelize.query(
        `SELECT table_name 
         FROM information_schema.tables 
         WHERE table_schema = :schemaName
         AND table_type = 'BASE TABLE'`,
        { replacements: { schemaName }, type: sequelize.QueryTypes.SELECT }
    );
    return tables.map(t => t.table_name);
}

async function getTableColumns(schemaName, tableName) {
    const columns = await sequelize.query(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns 
         WHERE table_schema = :schemaName 
         AND table_name = :tableName
         ORDER BY ordinal_position`,
        { replacements: { schemaName, tableName }, type: sequelize.QueryTypes.SELECT }
    );
    return columns;
}

async function getTenantRegistry() {
    const tenants = await sequelize.query(
        `SELECT business_id, schema_name, status, created_at, activated_at
         FROM "public"."tenant_registry"
         ORDER BY created_at DESC`,
        { type: sequelize.QueryTypes.SELECT }
    );
    return tenants;
}

async function auditSchema(schemaName, businessId) {
    const issues = [];
    const warnings = [];
    const existingTables = await getTablesInSchema(schemaName);
    const expectedTables = Object.values(MODEL_TO_TABLE);
    
    // Check for missing tables
    const missingTables = expectedTables.filter(t => !existingTables.includes(t));
    if (missingTables.length > 0) {
        issues.push({
            type: 'MISSING_TABLES',
            severity: 'CRITICAL',
            message: `Missing tables: ${missingTables.join(', ')}`,
            tables: missingTables
        });
    }
    
    // Check for extra tables (not necessarily an issue, but worth noting)
    const extraTables = existingTables.filter(t => !expectedTables.includes(t));
    if (extraTables.length > 0) {
        warnings.push({
            type: 'EXTRA_TABLES',
            severity: 'INFO',
            message: `Extra tables not in model definitions: ${extraTables.join(', ')}`,
            tables: extraTables
        });
    }
    
    // Check columns in each table
    const columnIssues = [];
    for (const tableName of existingTables) {
        const columns = await getTableColumns(schemaName, tableName);
        const columnNames = columns.map(c => c.column_name);
        
        // Check table-specific required columns
        if (TABLE_REQUIRED_COLUMNS[tableName]) {
            const requiredCols = TABLE_REQUIRED_COLUMNS[tableName];
            const missingCols = requiredCols.filter(c => !columnNames.includes(c));
            if (missingCols.length > 0) {
                columnIssues.push({
                    table: tableName,
                    missingColumns: missingCols,
                    severity: 'HIGH'
                });
            }
        }
        
        // Check system columns for all tables
        const missingSystemCols = SYSTEM_COLUMNS.filter(c => !columnNames.includes(c));
        if (missingSystemCols.length > 0) {
            // Only report if not already reported as table-specific
            if (!TABLE_REQUIRED_COLUMNS[tableName]) {
                columnIssues.push({
                    table: tableName,
                    missingColumns: missingSystemCols,
                    severity: 'MEDIUM'
                });
            }
        }
    }
    
    if (columnIssues.length > 0) {
        issues.push({
            type: 'MISSING_COLUMNS',
            severity: 'HIGH',
            message: `Missing columns in ${columnIssues.length} tables`,
            details: columnIssues
        });
    }
    
    // Check schema_versions table for migration tracking
    if (existingTables.includes('schema_versions')) {
        const versions = await sequelize.query(
            `SELECT version, migration_name, applied_at 
             FROM "${schemaName}"."schema_versions"
             ORDER BY version DESC`,
            { type: sequelize.QueryTypes.SELECT }
        );
        
        if (versions.length === 0) {
            warnings.push({
                type: 'NO_MIGRATION_HISTORY',
                severity: 'WARNING',
                message: 'schema_versions table exists but has no records'
            });
        }
    } else {
        issues.push({
            type: 'MISSING_MIGRATION_TABLE',
            severity: 'HIGH',
            message: 'schema_versions table missing - migration tracking not available'
        });
    }
    
    return {
        schemaName,
        businessId,
        tableCount: existingTables.length,
        expectedTableCount: expectedTables.length,
        missingTableCount: missingTables.length,
        issues,
        warnings,
        isHealthy: issues.length === 0,
        existingTables
    };
}

async function runAudit() {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║         COMPREHENSIVE TENANT SCHEMA AUDIT                     ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('\n');
    
    const startTime = Date.now();
    const schemas = await getTenantSchemas();
    const registry = await getTenantRegistry();
    
    console.log(`📊 Found ${schemas.length} tenant schemas in database`);
    console.log(`📋 Found ${registry.length} tenants in registry`);
    console.log('\n');
    
    const results = {
        total: schemas.length,
        healthy: 0,
        issues: 0,
        critical: 0,
        schemaDetails: []
    };
    
    // Audit each schema
    for (const schemaName of schemas) {
        const businessId = schemaName.replace(TENANT_SCHEMA_PREFIX, '');
        const registryEntry = registry.find(r => r.business_id === businessId);
        
        console.log(`🔍 Auditing ${schemaName}...`);
        const audit = await auditSchema(schemaName, businessId);
        
        // Add registry info
        audit.registryStatus = registryEntry?.status || 'UNKNOWN';
        audit.createdAt = registryEntry?.created_at;
        
        results.schemaDetails.push(audit);
        
        if (audit.isHealthy) {
            results.healthy++;
            console.log(`   ✅ Healthy - ${audit.tableCount} tables`);
        } else {
            results.issues++;
            console.log(`   ❌ Issues found - ${audit.issues.length} problems`);
            
            audit.issues.forEach(issue => {
                console.log(`      ${issue.severity}: ${issue.message}`);
                if (issue.type === 'MISSING_COLUMNS' && issue.details) {
                    issue.details.forEach(col => {
                        console.log(`         - ${col.table}: missing ${col.missingColumns.join(', ')}`);
                    });
                }
            });
        }
        
        // Count critical issues
        const criticalCount = audit.issues.filter(i => i.severity === 'CRITICAL').length;
        if (criticalCount > 0) results.critical += criticalCount;
    }
    
    // Summary
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                      AUDIT SUMMARY                            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`\nTotal Schemas: ${results.total}`);
    console.log(`Healthy: ${results.healthy} ✅`);
    console.log(`With Issues: ${results.issues} ❌`);
    console.log(`Critical Issues: ${results.critical} 🚨`);
    console.log(`\nExecution Time: ${Date.now() - startTime}ms`);
    
    // Save detailed report
    const fs = require('fs');
    const reportPath = './audit-reports';
    if (!fs.existsSync(reportPath)) {
        fs.mkdirSync(reportPath, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = `${reportPath}/schema-audit-${timestamp}.json`;
    
    fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportFile}`);
    
    // Generate SQL fix script for common issues
    const fixScript = generateFixScript(results.schemaDetails);
    const fixFile = `${reportPath}/schema-fix-${timestamp}.sql`;
    fs.writeFileSync(fixFile, fixScript);
    console.log(`🔧 Fix script saved to: ${fixFile}`);
    
    console.log('\n');
    
    await sequelize.close();
    return results;
}

function generateFixScript(schemas) {
    let script = `-- AUTO-GENERATED SCHEMA FIX SCRIPT
-- Generated: ${new Date().toISOString()}
-- Run this script to fix common schema issues
\n`;

    for (const schema of schemas) {
        const schemaName = schema.schemaName;
        
        // Fix missing columns
        const columnIssue = schema.issues.find(i => i.type === 'MISSING_COLUMNS');
        if (columnIssue && columnIssue.details) {
            for (const detail of columnIssue.details) {
                const tableName = detail.table;
                for (const col of detail.missingColumns) {
                    if (col === 'status' && tableName === 'product_types') {
                        script += `ALTER TABLE "${schemaName}"."${tableName}" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT 'active';\n`;
                    } else if (col === 'outlet_id') {
                        script += `ALTER TABLE "${schemaName}"."${tableName}" ADD COLUMN IF NOT EXISTS "outlet_id" UUID;\n`;
                    } else if (col === 'is_active') {
                        script += `ALTER TABLE "${schemaName}"."${tableName}" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT true;\n`;
                    } else if (col === 'is_enabled') {
                        script += `ALTER TABLE "${schemaName}"."${tableName}" ADD COLUMN IF NOT EXISTS "is_enabled" BOOLEAN DEFAULT true;\n`;
                    }
                }
            }
        }
        
        // Fix missing schema_versions table
        const migrationIssue = schema.issues.find(i => i.type === 'MISSING_MIGRATION_TABLE');
        if (migrationIssue) {
            script += `\n-- Create schema_versions table for ${schemaName}
CREATE TABLE IF NOT EXISTS "${schemaName}"."schema_versions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "version" INTEGER NOT NULL,
    "migration_name" VARCHAR(255),
    "description" TEXT,
    "applied_by" VARCHAR(255),
    "applied_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "business_id" UUID,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE("version")
);\n`;
        }
    }
    
    script += `\n-- Update complete\n`;
    return script;
}

// Run the audit
runAudit().catch(error => {
    console.error('Audit failed:', error);
    process.exit(1);
});
