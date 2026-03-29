/**
 * GLOBAL SCHEMA REPAIR SYSTEM
 * 
 * Auto-creates missing tables and adds missing columns for all tenants.
 * Ensures ALL tenants are aligned with the latest model definitions.
 */

const { sequelize } = require('../config/unified_database');
const { ModelFactory } = require('../src/architecture/modelFactory');

async function fixAllTenantSchemas() {
    console.log('🛠️ Starting Global Schema Repair...');
    const startTime = Date.now();

    try {
        // 1. Initialize models globally
        ModelFactory.setupModelDefinitions();
        const models = await ModelFactory.createModels(sequelize);
        const modelList = Object.values(models);

        // 2. Get all tenant schemas
        const schemas = await sequelize.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'tenant_%'
        `, { type: sequelize.QueryTypes.SELECT });

        console.log(`📋 Repairing ${schemas.length} tenant schemas.`);

        let successCount = 0;
        let failCount = 0;

        for (const { schema_name } of schemas) {
            console.log(`\n⚙️ Repairing [${schema_name}]`);
            
            try {
                // Ensure search_path is set (Phase 8 fallback safety)
                await sequelize.query(`SET search_path TO "${schema_name}"`);

                // Run migrations instead of sync - Data-First Compliance
                const migrationRunner = require('../src/architecture/migrationRunner');
                const SchemaVersion = models.SchemaVersion;
                const tenantModels = { SchemaVersion: SchemaVersion.schema(schema_name) };
                
                await migrationRunner.runPendingMigrations(sequelize, schema_name, tenantModels);
                console.log(`  ✅ ${schema_name} migrated successfully.`);
                successCount++;
            } catch (err) {
                console.error(`  ❌ Failed to repair ${schema_name}:`, err.message);
                failCount++;
            }
        }

        console.log(`\n✨ Repair complete in ${Date.now() - startTime}ms.`);
        console.log(`📊 Stats: ${successCount} Successes, ${failCount} Failures.`);

    } catch (error) {
        console.error('🔥 Global Repair failed:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

fixAllTenantSchemas();
