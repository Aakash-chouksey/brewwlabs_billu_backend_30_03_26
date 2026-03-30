const { sequelize } = require('../../config/unified_database');
const { DataTypes } = require('sequelize');
const tenantModelLoader = require('./tenantModelLoader');
const migrationRunner = require('./migrationRunner');

/**
 * STARTUP MIGRATION UTILITY
 * Runs pending migrations for ALL active tenants on application startup.
 * 
 * @param {Sequelize} controlPlaneSequelize - The control plane sequelize instance
 */
async function runStartupMigrations(controlPlaneSequelize) {
    if (!controlPlaneSequelize) {
        console.log('⏭️ [StartupMigration] Skipped - no control plane sequelize provided');
        return;
    }
    
    console.log('🚀 [StartupMigration] Initializing system-wide migrations...');
    const startTime = Date.now();

    try {
        // 1. Get Registry Model via ModelFactory (Ensures full field set)
        const { ModelFactory } = require('./modelFactory');
        const models = await ModelFactory.createModels(controlPlaneSequelize);
        const TenantRegistry = models.TenantRegistry;
        
        if (!TenantRegistry) {
            throw new Error('TenantRegistry model mapping failed in ModelFactory during startup migrations');
        }

        // 2. Fetch all active tenants
        const tenants = await TenantRegistry.findAll({
            where: { status: ['active', 'ACTIVE'] }
        });

        console.log(`[StartupMigration] 🔍 Found ${tenants.length} active tenants to check.`);

        for (const tenant of tenants) {
            const schemaName = tenant.schemaName;
            try {
                // Bind models for this tenant
                const tenantModels = await tenantModelLoader.getTenantModels(sequelize, schemaName);
                
                // Run migrations
                await migrationRunner.runPendingMigrations(sequelize, schemaName, tenantModels);
            } catch (tenantError) {
                console.error(`[StartupMigration] ❌ Failed migrations for ${schemaName}:`, tenantError.message);
                // Continue with other tenants
            }
        }

        const duration = (Date.now() - startTime) / 1000;
        console.log(`[StartupMigration] ✨ ALL MIGRATIONS COMPLETE in ${duration.toFixed(1)}s`);
    } catch (error) {
        console.error('[StartupMigration] 🚨 CRITICAL SYSTEM MIGRATION FAILED:', error.message);
    }
}

module.exports = { runStartupMigrations };
