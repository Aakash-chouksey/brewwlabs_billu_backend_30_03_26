/**
 * GLOBAL TENANT REPAIR SCRIPT
 * ===========================
 * 
 * 1. Fetches all active tenants from public.tenant_registry
 * 2. Runs deep integrity check for each schema
 * 3. Automatically repairs missing tables/columns using alter:true
 */

require('dotenv').config();
const { sequelize } = require('../../config/unified_database');
const tenantModelLoader = require('../../src/architecture/tenantModelLoader');
const { ModelFactory } = require('../../src/architecture/modelFactory');
const { CONTROL_PLANE, PUBLIC_SCHEMA } = require('../../src/utils/constants');

async function repairAllTenants() {
    console.log('🧪 STARTING GLOBAL TENANT REPAIR...');
    const startTime = Date.now();
    
    try {
        // 1. Initialize Control Plane
        await ModelFactory.createModels(sequelize);
        console.log('✅ Control plane models initialized.');

        // 2. Fetch all tenants
        const TenantRegistry = sequelize.models.TenantRegistry.schema(PUBLIC_SCHEMA);
        const tenants = await TenantRegistry.findAll({
            where: { status: 'active' },
            logging: false
        });

        console.log(`📊 Found ${tenants.length} tenants in registry.`);
        
        const stats = {
            total: tenants.length,
            healthy: 0,
            repaired: 0,
            failed: 0,
            skipped: 0
        };

        // 3. Process each tenant
        for (const tenant of tenants) {
            const { businessId, schemaName } = tenant;
            console.log(`\n🔍 Checking Tenant: ${businessId} [${schemaName}]...`);
            
            try {
                // A. Check for schema existence
                const [schemaExists] = await sequelize.query(`
                    SELECT schema_name FROM information_schema.schemata WHERE schema_name = :schema
                `, { replacements: { schema: schemaName }, type: sequelize.QueryTypes.SELECT, logging: false });

                if (!schemaExists) {
                    console.error(`  ❌ SCHEMA MISSING: ${schemaName}. Attempting to create...`);
                    await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`, { logging: false });
                }

                // B. Run integrity check
                const integrity = await tenantModelLoader.verifySchemaIntegrity(sequelize, schemaName);
                
                if (integrity.isValid) {
                    console.log(`  ✅ ${schemaName} is HEALTHY (${integrity.issues} issues).`);
                    stats.healthy++;
                } else {
                    console.warn(`  ⚠️  ${schemaName} has ${integrity.issues} ISSUES. Repairing...`);
                    console.warn(`    Missing Tables: ${integrity.missingTables.join(', ')}`);
                    console.warn(`    Missing Columns: ${integrity.missingColumns.join(', ')}`);
                    
                    // C. Run Repair
                    const repairResult = await tenantModelLoader.repairTenantSchema(sequelize, schemaName);
                    
                    if (repairResult.isValid) {
                        console.log(`  ✨ ${schemaName} REPAIRED SUCCESSFULLY.`);
                        stats.repaired++;
                    } else {
                        console.error(`  ❌ RELAPSE: ${schemaName} still has ${repairResult.issues} issues after repair.`);
                        stats.failed++;
                    }
                }
            } catch (tenantError) {
                console.error(`  🔥 ERROR processing ${schemaName}:`, tenantError.message);
                stats.failed++;
            }
        }

        // 4. Summary
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log('\n' + '='.repeat(40));
        console.log('🏁 REPAIR COMPLETE summary:');
        console.log(`⏱️  Duration: ${duration}s`);
        console.log(`📊 Total Tenants: ${stats.total}`);
        console.log(`✅ Healthy:       ${stats.healthy}`);
        console.log(`🛠️  Repaired:      ${stats.repaired}`);
        console.log(`❌ Failed:        ${stats.failed}`);
        console.log(`⏩ Skipped:       ${stats.skipped}`);
        console.log('='.repeat(40));

    } catch (error) {
        console.error('🔥 FATAL REPAIR ERROR:', error);
    } finally {
        await sequelize.close();
    }
}

// Ensure database connection is established
repairAllTenants();
