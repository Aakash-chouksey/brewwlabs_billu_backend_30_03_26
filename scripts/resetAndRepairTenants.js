#!/usr/bin/env node
/**
 * 🔧 COMPLETE TENANT RESET & REPAIR
 * Drops and recreates broken tenant schemas with proper migrations
 */

const { sequelize } = require('../config/unified_database');
const { Sequelize } = require('sequelize');
const tenantModelLoader = require('../src/architecture/tenantModelLoader');
const migrationRunner = require('../src/architecture/migrationRunner');
const { CONTROL_MODELS } = require('../src/utils/constants');

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m'
};

class TenantResetService {
    constructor() {
        this.results = [];
    }

    log(level, message, details = null) {
        const prefix = {
            info: `${colors.cyan}[INFO]${colors.reset}`,
            success: `${colors.green}[✓]${colors.reset}`,
            warning: `${colors.yellow}[⚠]${colors.reset}`,
            error: `${colors.red}[✗]${colors.reset}`,
            section: `${colors.magenta}[▶]${colors.reset}`
        }[level] || `[${level.toUpperCase()}]`;
        console.log(`${prefix} ${message}`);
        if (details) console.log(`  ${colors.blue}↳${colors.reset}`, details);
    }

    async run() {
        console.log(`\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}`);
        console.log(`${colors.bright}${colors.magenta}         TENANT RESET & REPAIR SERVICE${colors.reset}`);
        console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

        try {
            await sequelize.authenticate();
            this.log('success', 'Database connected');

            // Get all tenants from registry
            const registries = await sequelize.query(
                'SELECT business_id, schema_name, status FROM public.tenant_registry',
                { type: Sequelize.QueryTypes.SELECT }
            );

            this.log('info', `Found ${registries.length} tenants to process`);

            for (const registry of registries) {
                await this.resetAndRepair(registry);
            }

            this.generateReport();

        } catch (error) {
            this.log('error', 'Service failed', error.message);
            console.error(error.stack);
        } finally {
            await sequelize.close();
        }
    }

    async resetAndRepair(registry) {
        const { business_id, schema_name, status } = registry;
        
        this.log('section', `Processing: ${schema_name}`);

        try {
            // 1. Check schema existence
            const schemaExists = await sequelize.query(
                'SELECT schema_name FROM information_schema.schemata WHERE schema_name = :schema',
                { replacements: { schema: schema_name }, type: Sequelize.QueryTypes.SELECT }
            );

            if (schemaExists.length > 0) {
                // 2. Get current table count
                const existingTables = await sequelize.query(
                    'SELECT table_name FROM information_schema.tables WHERE table_schema = :schema AND table_type = \'BASE TABLE\'',
                    { replacements: { schema: schema_name }, type: Sequelize.QueryTypes.SELECT }
                );

                const tableCount = existingTables.length;
                this.log('info', `Schema exists with ${tableCount} tables`);

                // If tables are incomplete, reset and rebuild
                if (tableCount < 10) {
                    this.log('warning', `Schema incomplete, resetting...`);
                    
                    // Drop and recreate schema
                    await sequelize.query(`DROP SCHEMA IF EXISTS "${schema_name}" CASCADE`);
                    this.log('success', 'Dropped incomplete schema');
                    
                    await sequelize.query(`CREATE SCHEMA "${schema_name}"`);
                    this.log('success', 'Created fresh schema');
                } else {
                    this.log('success', 'Schema already complete, skipping');
                    this.results.push({ schema: schema_name, status: 'skipped', tables: tableCount });
                    return;
                }
            } else {
                // Create schema
                await sequelize.query(`CREATE SCHEMA "${schema_name}"`);
                this.log('success', 'Created new schema');
            }

            // 3. Create schema_versions table
            await sequelize.query(`
                CREATE TABLE "${schema_name}"."schema_versions" (
                    "version" INTEGER PRIMARY KEY,
                    "migration_name" VARCHAR(255),
                    "description" TEXT,
                    "checksum" VARCHAR(64),
                    "applied_by" VARCHAR(255),
                    "applied_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            `);

            // 4. Initialize at version 0
            await sequelize.query(`
                INSERT INTO "${schema_name}"."schema_versions" (version, migration_name, description, applied_by) 
                VALUES (0, 'init', 'Fresh start', 'repair_service')
            `);

            // 5. Run essential table creation first
            await this.createEssentialTables(schema_name, business_id);

            // 6. Run migrations
            await this.runMigrations(schema_name, business_id);

            // 7. Verify
            const finalTables = await sequelize.query(
                'SELECT table_name FROM information_schema.tables WHERE table_schema = :schema AND table_type = \'BASE TABLE\'',
                { replacements: { schema: schema_name }, type: Sequelize.QueryTypes.SELECT }
            );

            this.log('success', `Repair complete: ${finalTables.length} tables created`);
            this.results.push({ schema: schema_name, status: 'repaired', tables: finalTables.length });

            // 8. Update registry status
            await sequelize.query(
                'UPDATE public.tenant_registry SET status = \'READY\' WHERE business_id = :businessId',
                { replacements: { businessId: business_id } }
            );

        } catch (error) {
            this.log('error', `Failed: ${schema_name}`, error.message);
            this.results.push({ schema: schema_name, status: 'failed', error: error.message });
            
            await sequelize.query(
                'UPDATE public.tenant_registry SET status = \'init_failed\' WHERE business_id = :businessId',
                { replacements: { businessId: business_id } }
            ).catch(() => {});
        }
    }

    async createEssentialTables(schemaName, businessId) {
        this.log('info', 'Creating essential tables...');

        const outletId = require('uuid').v4();

        // Create outlets table (matches model definition)
        await sequelize.query(`
            CREATE TABLE "${schemaName}"."outlets" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "name" VARCHAR(255) NOT NULL,
                "address" TEXT,
                "manager_user_id" UUID,
                "parent_outlet_id" UUID,
                "is_head_office" BOOLEAN DEFAULT false,
                "email" VARCHAR(255),
                "phone" VARCHAR(255),
                "gst_number" VARCHAR(255),
                "status" VARCHAR(255) DEFAULT 'active',
                "is_active" BOOLEAN DEFAULT true,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        `);

        // Create settings table
        await sequelize.query(`
            CREATE TABLE "${schemaName}"."settings" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "business_id" UUID NOT NULL,
                "outlet_id" UUID NOT NULL,
                "app_name" VARCHAR(255) DEFAULT 'BrewwLabs POS',
                "logo_url" VARCHAR(255),
                "support_email" VARCHAR(255),
                "support_phone" VARCHAR(255),
                "terms_url" VARCHAR(255),
                "privacy_url" VARCHAR(255),
                "maintenance_mode" BOOLEAN DEFAULT false,
                "currency" VARCHAR(255) DEFAULT 'INR',
                "timezone" VARCHAR(255) DEFAULT 'Asia/Kolkata',
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        `);

        // Insert default outlet
        await sequelize.query(`
            INSERT INTO "${schemaName}"."outlets" 
            (id, business_id, name, status, is_active, is_head_office, created_at, updated_at)
            VALUES (:outletId, :businessId, 'Main Outlet', 'active', true, true, NOW(), NOW())
        `, { replacements: { outletId, businessId } });

        // Insert default settings
        await sequelize.query(`
            INSERT INTO "${schemaName}"."settings" 
            (id, business_id, outlet_id, created_at, updated_at)
            VALUES (gen_random_uuid(), :businessId, :outletId, NOW(), NOW())
        `, { replacements: { outletId, businessId } });

        this.log('success', 'Essential tables created with default data');
    }

    async runMigrations(schemaName, businessId) {
        this.log('info', 'Running migrations...');

        // Get tenant models
        const tenantModels = {};
        const allModelNames = Object.keys(sequelize.models);
        for (const modelName of allModelNames) {
            const model = sequelize.models[modelName];
            if (CONTROL_MODELS.includes(modelName)) continue;
            tenantModels[modelName] = model.schema(schemaName);
        }

        // Run migration runner
        await migrationRunner.runPendingMigrations(sequelize, schemaName, tenantModels);

        this.log('success', 'Migrations complete');
    }

    generateReport() {
        console.log(`\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}`);
        console.log(`${colors.bright}${colors.magenta}                    REPAIR REPORT${colors.reset}`);
        console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

        const repaired = this.results.filter(r => r.status === 'repaired');
        const skipped = this.results.filter(r => r.status === 'skipped');
        const failed = this.results.filter(r => r.status === 'failed');

        console.log(`${colors.green}✅ Repaired: ${repaired.length}${colors.reset}`);
        repaired.forEach(r => console.log(`   - ${r.schema}: ${r.tables} tables`));

        console.log(`\n${colors.yellow}⏭️  Skipped: ${skipped.length}${colors.reset}`);
        skipped.forEach(s => console.log(`   - ${s.schema}: ${s.tables} tables`));

        console.log(`\n${colors.red}❌ Failed: ${failed.length}${colors.reset}`);
        failed.forEach(f => console.log(`   - ${f.schema}: ${f.error}`));

        console.log(`\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}\n`);
    }
}

// Run if called directly
if (require.main === module) {
    const service = new TenantResetService();
    service.run();
}

module.exports = TenantResetService;
