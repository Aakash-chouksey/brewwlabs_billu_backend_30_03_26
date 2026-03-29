const { sequelize } = require('../../config/unified_database');
const { DataTypes } = require('sequelize');
const tenantModelLoader = require('./tenantModelLoader');

/**
 * STARTUP VALIDATOR
 * Performs schema integrity checks for all active tenants on boot.
 * 
 * @param {Sequelize} controlPlaneSequelize - The control plane sequelize instance
 */
async function runStartupValidation(controlPlaneSequelize) {
    if (!controlPlaneSequelize) {
        console.log('⏭️ [StartupValidator] Skipped - no control plane sequelize provided');
        return;
    }
    
    console.log('🛡️ [StartupValidator] Starting system integrity audit...');
    const startTime = Date.now();

    try {
        // 1. Fetch all active tenants
        const [tenants] = await controlPlaneSequelize.query(`
            SELECT schema_name FROM public.tenant_registry WHERE status = 'active'
        `);

        if (!tenants || tenants.length === 0) {
            console.log('[StartupValidator] ℹ️ No active tenants to validate.');
            return;
        }

        console.log(`[StartupValidator] 🔍 Auditing ${tenants.length} tenant schemas...`);

        const stats = { total: tenants.length, healthy: 0, drifted: 0, failed: 0 };

        for (const tenant of tenants) {
            const schemaName = tenant.schema_name;
            try {
                // Perform deep integrity check
                const integrity = await tenantModelLoader.verifySchemaIntegrity(sequelize, schemaName);
                
                if (integrity.isValid) {
                    stats.healthy++;
                } else {
                    console.warn(`[StartupValidator] ⚠️ DRIFT DETECTED in ${schemaName}: ${integrity.issues} issues.`);
                    // Detailed log (optional but helpful)
                    if (integrity.missingTables.length > 0) 
                        console.warn(`  - Missing Tables: ${integrity.missingTables.join(', ')}`);
                    if (integrity.missingColumns.length > 0)
                        console.warn(`  - Missing Columns: ${integrity.missingColumns.join(', ')}`);
                        
                    stats.drifted++;
                }
            } catch (error) {
                console.error(`[StartupValidator] ❌ Audit failed for ${schemaName}:`, error.message);
                stats.failed++;
            }
        }

        const duration = (Date.now() - startTime) / 1000;
        console.log('\n🛡️ [StartupValidator] AUDIT COMPLETE sumary:');
        console.log(`  ⏱️  Duration: ${duration.toFixed(1)}s`);
        console.log(`  📊 Healthy:  ${stats.healthy} / ${stats.total}`);
        if (stats.drifted > 0) console.log(`  ⚠️  Drifted: ${stats.drifted}`);
        if (stats.failed > 0)  console.log(`  ❌ Failed:   ${stats.failed}`);
        
        if (stats.drifted === 0 && stats.failed === 0) {
            console.log('✅ [StartupValidator] ALL SCHEMAS ARE HEALTHY AND ALIGNED.');
        } else {
            console.warn('⚡ [StartupValidator] ATTENTION: Some schemas require repair.');
        }

    } catch (error) {
        console.error('[StartupValidator] 🚨 Audit failed to start:', error.message);
    }
}

module.exports = { runStartupValidation };
