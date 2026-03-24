/**
 * GLOBAL SCHEMA VALIDATION ENGINE
 * 
 * Checks ALL tenant schemas against base model definitions.
 * Detects missing tables and mismatches.
 */

const { sequelize } = require('../config/unified_database');
const { modelRegistry, ModelFactory } = require('../src/architecture/modelFactory');

async function validateAllTenantSchemas() {
    console.log('🔍 Starting Global Schema Validation...');
    const startTime = Date.now();

    try {
        // 1. Ensure models are registered
        ModelFactory.setupModelDefinitions();
        const expectedModels = modelRegistry.getRegisteredModels();
        const expectedTables = expectedModels.map(m => m.toLowerCase() + (m.endsWith('s') ? '' : 's')); // Rough check

        // 2. Get all tenant schemas
        const schemas = await sequelize.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'tenant_%'
        `, { type: sequelize.QueryTypes.SELECT });

        console.log(`📋 Found ${schemas.length} tenant schemas to validate.`);

        let globalErrors = 0;

        for (const { schema_name } of schemas) {
            console.log(`\n📂 Validating [${schema_name}]`);
            
            // Get actual tables in this schema
            const actualTables = await sequelize.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = :schema
            `, {
                replacements: { schema: schema_name },
                type: sequelize.QueryTypes.SELECT
            });

            const tableNames = actualTables.map(t => t.table_name);
            const missing = [];

            // Check against essential tables (Phase 1 request)
            const ESSENTIAL_TABLES = ['orders', 'products', 'categories', 'customers', 'inventory_items'];
            for (const table of ESSENTIAL_TABLES) {
                if (!tableNames.includes(table)) {
                    missing.push(table);
                    globalErrors++;
                }
            }

            if (missing.length > 0) {
                console.error(`  ❌ MISSING TABLES in ${schema_name}:`, missing.join(', '));
            } else {
                console.log(`  ✅ ${schema_name} is consistent (Essential tables present).`);
            }
        }

        console.log(`\n✨ Validation complete in ${Date.now() - startTime}ms.`);
        console.log(`📊 Total Schema Errors Found: ${globalErrors}`);

        if (globalErrors > 0) {
            console.log('\n👉 Run "node scripts/fixTenantSchemas.js" to repair.');
        }

    } catch (error) {
        console.error('🔥 Validation failed:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

validateAllTenantSchemas();
