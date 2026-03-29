#!/usr/bin/env node
/**
 * 🔧 TENANT SCHEMA REPAIR SCRIPT
 * Repairs incomplete tenant schemas by running pending migrations
 */

const { sequelize } = require('../config/unified_database');
const { Sequelize } = require('sequelize');
const migrationRunner = require('../src/architecture/migrationRunner');
const tenantModelLoader = require('../src/architecture/tenantModelLoader');
const { CONTROL_MODELS } = require('../src/utils/constants');

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

class TenantRepairService {
    constructor() {
        this.repaired = [];
        this.failed = [];
        this.skipped = [];
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
        if (details) console.log(`${colors.blue}  ↳${colors.reset}`, details);
    }

    async run() {
        console.log(`\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}`);
        console.log(`${colors.bright}${colors.magenta}              TENANT SCHEMA REPAIR SERVICE${colors.reset}`);
        console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

        try {
            await sequelize.authenticate();
            this.log('success', 'Database connected');

            // Get all tenant schemas from registry
            const registries = await sequelize.query(
                'SELECT business_id, schema_name, status FROM public.tenant_registry',
                { type: Sequelize.QueryTypes.SELECT }
            );

            this.log('info', `Found ${registries.length} tenant registry entries`);

            for (const registry of registries) {
                await this.repairTenant(registry);
            }

            this.generateReport();

        } catch (error) {
            this.log('error', 'Repair service failed', error.message);
            console.error(error.stack);
        } finally {
            await sequelize.close();
        }
    }

    async repairTenant(registry) {
        const { business_id, schema_name, status } = registry;
        
        this.log('section', `Repairing: ${schema_name}`);
        this.log('info', `Business ID: ${business_id}, Current status: ${status}`);

        try {
            // 1. Check if schema exists
            const schemaExists = await sequelize.query(
                'SELECT schema_name FROM information_schema.schemata WHERE schema_name = :schema',
                { replacements: { schema: schema_name }, type: Sequelize.QueryTypes.SELECT }
            );

            if (schemaExists.length === 0) {
                this.log('error', `Schema ${schema_name} does not exist!`);
                this.failed.push({ schema: schema_name, reason: 'Schema does not exist' });
                return;
            }

            // 2. Check current tables
            const existingTables = await sequelize.query(
                'SELECT table_name FROM information_schema.tables WHERE table_schema = :schema AND table_type = \'BASE TABLE\'',
                { replacements: { schema: schema_name }, type: Sequelize.QueryTypes.SELECT }
            );
            
            const tableNames = existingTables.map(t => t.table_name);
            this.log('info', `Existing tables: ${tableNames.length}`, tableNames.join(', '));

            // 3. Check schema version
            const versionResult = await sequelize.query(
                `SELECT MAX(version) as max_version FROM "${schema_name}"."schema_versions"`,
                { type: Sequelize.QueryTypes.SELECT }
            ).catch(() => [{ max_version: 0 }]);

            const currentVersion = versionResult[0]?.max_version || 0;
            this.log('info', `Current schema version: ${currentVersion}`);

            // 4. If at version 0 or missing tables, run migrations
            const criticalTables = ['products', 'orders', 'order_items', 'inventory_items', 'categories'];
            const missingTables = criticalTables.filter(t => !tableNames.includes(t));

            if (currentVersion < 1 || missingTables.length > 0) {
                this.log('warning', `Missing ${missingTables.length} critical tables`, missingTables.join(', '));
                
                // Update status to migrating
                await sequelize.query(
                    'UPDATE public.tenant_registry SET status = \'migrating\' WHERE business_id = :businessId',
                    { replacements: { businessId: business_id } }
                );

                // Initialize tenant models
                const tenantModels = {};
                const allModelNames = Object.keys(sequelize.models);
                for (const modelName of allModelNames) {
                    const model = sequelize.models[modelName];
                    if (CONTROL_MODELS.includes(modelName)) continue;
                    tenantModels[modelName] = model.schema(schema_name);
                }

                // Run migrations
                this.log('info', 'Running pending migrations...');
                await migrationRunner.runPendingMigrations(sequelize, schema_name, tenantModels);

                // Update status to READY
                await sequelize.query(
                    'UPDATE public.tenant_registry SET status = \'READY\' WHERE business_id = :businessId',
                    { replacements: { businessId: business_id } }
                );

                // Verify repair
                const newTables = await sequelize.query(
                    'SELECT table_name FROM information_schema.tables WHERE table_schema = :schema AND table_type = \'BASE TABLE\'',
                    { replacements: { schema: schema_name }, type: Sequelize.QueryTypes.SELECT }
                );
                
                const newTableNames = newTables.map(t => t.table_name);
                const stillMissing = criticalTables.filter(t => !newTableNames.includes(t));

                if (stillMissing.length === 0) {
                    this.log('success', `✅ ${schema_name} fully repaired! Tables: ${newTableNames.length}`);
                    this.repaired.push({ schema: schema_name, tables: newTableNames.length });
                } else {
                    this.log('error', `⚠️ ${schema_name} still missing tables`, stillMissing.join(', '));
                    this.failed.push({ schema: schema_name, reason: `Still missing: ${stillMissing.join(', ')}` });
                }
            } else {
                this.log('success', `Schema ${schema_name} is already complete`);
                this.skipped.push({ schema: schema_name, tables: tableNames.length });
            }

        } catch (error) {
            this.log('error', `Failed to repair ${schema_name}`, error.message);
            this.failed.push({ schema: schema_name, reason: error.message });
            
            // Mark as failed in registry
            try {
                await sequelize.query(
                    'UPDATE public.tenant_registry SET status = \'init_failed\' WHERE business_id = :businessId',
                    { replacements: { businessId: business_id } }
                );
            } catch (e) {}
        }
    }

    generateReport() {
        console.log(`\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}`);
        console.log(`${colors.bright}${colors.magenta}                    REPAIR REPORT${colors.reset}`);
        console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

        console.log(`${colors.green}✅ Repaired: ${this.repaired.length}${colors.reset}`);
        this.repaired.forEach(r => console.log(`   - ${r.schema}: ${r.tables} tables`));

        console.log(`\n${colors.yellow}⏭️  Skipped: ${this.skipped.length}${colors.reset}`);
        this.skipped.forEach(s => console.log(`   - ${s.schema}: ${s.tables} tables`));

        console.log(`\n${colors.red}❌ Failed: ${this.failed.length}${colors.reset}`);
        this.failed.forEach(f => console.log(`   - ${f.schema}: ${f.reason}`));

        console.log(`\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}\n`);
    }
}

// Run if called directly
if (require.main === module) {
    const repair = new TenantRepairService();
    repair.run();
}

module.exports = TenantRepairService;
