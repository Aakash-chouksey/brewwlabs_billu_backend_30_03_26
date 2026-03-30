const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const neonTransactionSafeExecutor = require('./neonTransactionSafeExecutor');
const { TENANT_SCHEMA_PREFIX, PUBLIC_SCHEMA } = require('../src/utils/constants');

/**
 * TENANT MIGRATION SERVICE
 * 
 * Handles running JS migrations from migrations/tenant/ per tenant schema.
 */
class TenantMigrationService {
    constructor() {
        this.migrationsPath = path.join(__dirname, '../migrations/tenant');
    }

    /**
     * Get all available migration files
     */
    getAvailableMigrations() {
        if (!fs.existsSync(this.migrationsPath)) {
            console.warn(`[TenantMigrationService] Migrations path not found: ${this.migrationsPath}`);
            return [];
        }

        return fs.readdirSync(this.migrationsPath)
            .filter(file => file.endsWith('.js'))
            .map(file => {
                const migration = require(path.join(this.migrationsPath, file));
                return {
                    file,
                    version: migration.version,
                    description: migration.description,
                    migration
                };
            })
            .sort((a, b) => a.version - b.version);
    }

    /**
     * Run pending migrations for a specific tenant
     */
    async runPendingMigrations(businessId) {
        const tenantId = businessId;
        const schemaName = `${TENANT_SCHEMA_PREFIX}${businessId}`;
        
        console.log(`[TenantMigrationService] 🚀 Checking pending migrations for tenant: ${businessId} (${schemaName})`);

        return await neonTransactionSafeExecutor.executeWithTenant(tenantId, async (context) => {
            const { transaction, transactionModels: models, sequelize } = context;
            const { SchemaVersion } = models;

            // 1. Get current version from schema_versions table
            let currentVersion = -1;
            try {
                const latest = await SchemaVersion.findOne({
                    order: [['version', 'DESC']],
                    transaction
                });
                if (latest) {
                    currentVersion = latest.version;
                }
            } catch (err) {
                console.warn(`[TenantMigrationService] ⚠️ Could not find schema_versions table or it's empty in ${schemaName}. Assuming version -1.`);
            }

            console.log(`[TenantMigrationService] Current version for ${schemaName}: v${currentVersion}`);

            // 2. Get all pending migrations
            const allMigrations = this.getAvailableMigrations();
            const pendingMigrations = allMigrations.filter(m => m.version > currentVersion);

            if (pendingMigrations.length === 0) {
                console.log(`[TenantMigrationService] ✅ No pending migrations for ${schemaName}`);
                return { success: true, migrationsRun: 0 };
            }

            console.log(`[TenantMigrationService] Found ${pendingMigrations.length} pending migrations for ${schemaName}`);

            // 3. Run each migration in sequence
            for (const m of pendingMigrations) {
                console.log(`[TenantMigrationService] 🏃 Running migration v${m.version}: ${m.description}`);
                
                try {
                    // Execute migration 'up' function
                    await m.migration.up(sequelize, schemaName, models, transaction);

                    // Record migration as applied
                    await SchemaVersion.create({
                        version: m.version,
                        migrationName: m.file,
                        description: m.description,
                        appliedBy: 'TenantMigrationService',
                        appliedAt: new Date(),
                        businessId: businessId
                    }, { transaction });

                    console.log(`[TenantMigrationService] ✅ Migration v${m.version} applied successfully to ${schemaName}`);
                } catch (error) {
                    console.error(`[TenantMigrationService] ❌ FAILED migration v${m.version} for ${schemaName}:`, error.message);
                    throw error; // Rollback transaction
                }
            }

            return {
                success: true,
                migrationsRun: pendingMigrations.length,
                appliedVersions: pendingMigrations.map(m => m.version)
            };
        });
    }

    /**
     * Migrate ALL tenants in the system
     */
    async migrateAllTenants() {
        console.log('[TenantMigrationService] 🌐 Starting global tenant migration...');
        
        const sequelize = require('../config/unified_database').sequelize;
        
        // 1. Get all active tenants from registry
        const tenants = await sequelize.query(
            `SELECT business_id, schema_name FROM "public"."tenant_registry" WHERE status = 'ACTIVE'`,
            { type: Sequelize.QueryTypes.SELECT }
        );

        console.log(`[TenantMigrationService] Found ${tenants.length} active tenants to migrate.`);

        const results = {
            total: tenants.length,
            success: 0,
            failed: 0,
            details: []
        };

        for (const tenant of tenants) {
            try {
                const result = await this.runPendingMigrations(tenant.business_id);
                results.success++;
                results.details.push({
                    businessId: tenant.business_id,
                    success: true,
                    migrationsRun: result.data.migrationsRun
                });
            } catch (error) {
                results.failed++;
                results.details.push({
                    businessId: tenant.business_id,
                    success: false,
                    error: error.message
                });
                console.error(`[TenantMigrationService] ❌ Failed to migrate tenant ${tenant.business_id}:`, error.message);
            }
        }

        console.log(`[TenantMigrationService] Global migration complete. Success: ${results.success}, Failed: ${results.failed}`);
        return results;
    }
}

module.exports = new TenantMigrationService();
