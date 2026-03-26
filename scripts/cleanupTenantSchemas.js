/**
 * 🧹 TENANT SCHEMA CLEANUP SCRIPT
 * 
 * Removes control plane tables from tenant schemas
 * Ensures all tenant tables exist consistently
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

// 🔒 CONTROL MODELS (should NEVER be in tenant schemas)
const CONTROL_MODELS = [
    'User',
    'Business', 
    'TenantRegistry',
    'ClusterMetadata',
    'Plan',
    'Subscription',
    'SuperAdminUser',
    'TenantConnection',
    'TenantMigrationLog'
];

// ✅ REQUIRED TENANT TABLES (must exist in every tenant)
const REQUIRED_TENANT_TABLES = [
    'outlets', 'categories', 'areas', 'product_types', 'inventory_categories',
    'customers', 'suppliers', 'expense_types', 'billing_configs', 'timings',
    'settings', 'feature_flags', 'membership_plans', 'partner_types', 'accounts',
    'products', 'tables', 'recipes', 'purchases', 'orders', 'expenses', 'income',
    'payments', 'partner_memberships', 'partner_wallets', 'inventory', 
    'inventory_items', 'wastages', 'order_items', 'recipe_items', 'purchase_items',
    'inventory_transactions', 'customer_transactions', 'customer_ledger',
    'transactions', 'audit_logs', 'stock_transactions', 'inventory_sales',
    'roll_tracking', 'web_contents', 'operation_timings'
];

// Tables that may have been created incorrectly in tenants
const WRONG_TABLES_IN_TENANT = [
    'users', 'businesses', 'tenant_registry', 'cluster_metadata',
    'plans', 'subscriptions', 'super_admin_users', 'tenant_connections',
    'tenant_migration_logs'
];

async function cleanupTenantSchemas() {
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        logging: false
    });

    try {
        console.log('🔍 Scanning for tenant schemas...');
        
        // Get all tenant schemas
        const schemas = await sequelize.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'tenant_%'
            ORDER BY schema_name
        `, { type: Sequelize.QueryTypes.SELECT });

        console.log(`📊 Found ${schemas.length} tenant schemas`);

        const results = {
            schemasProcessed: 0,
            wrongTablesDropped: 0,
            missingTablesCreated: 0,
            errors: []
        };

        for (const { schema_name } of schemas) {
            console.log(`\n🔄 Processing schema: ${schema_name}`);
            
            try {
                // Step 1: Get existing tables in schema
                const existingTables = await sequelize.query(`
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = :schema
                    AND table_type = 'BASE TABLE'
                `, {
                    replacements: { schema: schema_name },
                    type: Sequelize.QueryTypes.SELECT
                });

                const tablesInSchema = existingTables.map(t => t.table_name);
                console.log(`   📋 Found ${tablesInSchema.length} tables`);

                // Step 2: Drop wrong tables (control plane tables)
                for (const wrongTable of WRONG_TABLES_IN_TENANT) {
                    if (tablesInSchema.includes(wrongTable)) {
                        console.log(`   🗑️  Dropping wrong table: ${wrongTable}`);
                        await sequelize.query(
                            `DROP TABLE IF EXISTS "${schema_name}".${wrongTable} CASCADE`
                        );
                        results.wrongTablesDropped++;
                    }
                }

                // Step 3: Check for missing required tables
                const missingTables = REQUIRED_TENANT_TABLES.filter(
                    table => !tablesInSchema.includes(table)
                );

                if (missingTables.length > 0) {
                    console.log(`   ⚠️  Missing tables: ${missingTables.join(', ')}`);
                    // Note: Tables will be created by tenantModelLoader on next access
                    results.missingTablesCreated += missingTables.length;
                }

                // Step 4: Verify final state
                const finalTables = await sequelize.query(`
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = :schema
                    AND table_type = 'BASE TABLE'
                `, {
                    replacements: { schema: schema_name },
                    type: Sequelize.QueryTypes.SELECT
                });

                console.log(`   ✅ Final: ${finalTables.length} tables in schema`);
                results.schemasProcessed++;

            } catch (error) {
                console.error(`   ❌ Error processing ${schema_name}:`, error.message);
                results.errors.push({ schema: schema_name, error: error.message });
            }
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 CLEANUP SUMMARY');
        console.log('='.repeat(60));
        console.log(`Schemas processed: ${results.schemasProcessed}`);
        console.log(`Wrong tables dropped: ${results.wrongTablesDropped}`);
        console.log(`Missing tables identified: ${results.missingTablesCreated}`);
        console.log(`Errors: ${results.errors.length}`);

        if (results.errors.length > 0) {
            console.log('\n❌ ERRORS:');
            results.errors.forEach(e => {
                console.log(`  - ${e.schema}: ${e.error}`);
            });
        }

        return results;

    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        throw error;
    } finally {
        await sequelize.close();
        console.log('\n🔒 Database connection closed');
    }
}

// Run if called directly
if (require.main === module) {
    cleanupTenantSchemas()
        .then(() => {
            console.log('\n✅ Cleanup complete');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Cleanup failed:', error);
            process.exit(1);
        });
}

module.exports = { cleanupTenantSchemas, CONTROL_MODELS, REQUIRED_TENANT_TABLES };
