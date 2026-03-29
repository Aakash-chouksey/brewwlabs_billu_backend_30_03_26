#!/usr/bin/env node

/**
 * Schema-Per-Tenant Data Migration Script
 * 
 * MIGRATES existing public schema data to isolated tenant schemas
 * 
 * Usage: node scripts/migrateToSchemaPerTenant.js [--dry-run] [--tenant=<id>]
 */

const { sequelize } = require('../config/unified_database');
const { controlPlaneSequelize } = require('../config/control_plane_db');
const { createTenantSchema } = require('../config/unified_database');
const { ModelFactory } = require('../src/architecture/modelFactory');

class SchemaMigrationService {
    constructor() {
        this.migrationLog = [];
        this.errors = [];
        this.dryRun = process.argv.includes('--dry-run');
        this.targetTenant = this.parseTargetTenant();
    }

    parseTargetTenant() {
        const arg = process.argv.find(a => a.startsWith('--tenant='));
        return arg ? arg.split('=')[1] : null;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            progress: '🔄'
        }[type] || 'ℹ️';
        
        const logEntry = `${prefix} [${timestamp}] ${message}`;
        console.log(logEntry);
        this.migrationLog.push({ timestamp, message, type });
    }

    /**
     * Get all businesses that need tenant schemas
     */
    async getBusinesses() {
        try {
            const [businesses] = await controlPlaneSequelize.query(
                `SELECT id, name, email, status FROM businesses ORDER BY created_at ASC`
            );
            
            if (this.targetTenant) {
                return businesses.filter(b => b.id === this.targetTenant);
            }
            
            return businesses;
        } catch (error) {
            this.log(`Failed to fetch businesses: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Check if tenant schema already exists
     */
    async schemaExists(schemaName) {
        const [result] = await sequelize.query(
            `SELECT schema_name FROM information_schema.schemata WHERE schema_name = '${schemaName}'`
        );
        return result.length > 0;
    }

    /**
     * Create tenant schema and initialize tables
     */
    async createTenantSchemaAndTables(businessId) {
        const schemaName = `tenant_${businessId}`;
        
        try {
            // Check if exists
            if (await this.schemaExists(schemaName)) {
                this.log(`Schema ${schemaName} already exists`, 'warning');
                return schemaName;
            }

            if (this.dryRun) {
                this.log(`[DRY RUN] Would create schema: ${schemaName}`, 'info');
                return schemaName;
            }

            // Create schema
            await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
            this.log(`Created schema: ${schemaName}`, 'success');

            // Initialize models and run migrations (Data-First approach)
            await ModelFactory.createModels(sequelize);
            
            // Run migrations instead of sync
            const migrationRunner = require('../src/architecture/migrationRunner');
            const SchemaVersion = require('../models/schemaVersionModel')(sequelize);
            const tenantModels = { SchemaVersion: SchemaVersion.schema(schemaName) };
            
            await migrationRunner.runPendingMigrations(sequelize, schemaName, tenantModels);
            this.log(`Migrations complete for: ${schemaName}`, 'success');

            return schemaName;
        } catch (error) {
            this.log(`Failed to create schema/tables for ${schemaName}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Migrate business data to tenant schema
     */
    async migrateBusinessData(businessId, schemaName) {
        try {
            if (this.dryRun) {
                this.log(`[DRY RUN] Would migrate business ${businessId} to ${schemaName}`, 'info');
                return;
            }

            // Get business data from public schema
            const [businesses] = await sequelize.query(
                `SELECT * FROM public.businesses WHERE id = :businessId`,
                { replacements: { businessId } }
            );

            if (!businesses.length) {
                this.log(`No business found in public schema for ID: ${businessId}`, 'warning');
                return;
            }

            const business = businesses[0];

            // Insert into tenant schema
            await sequelize.query(
                `INSERT INTO "${schemaName}".businesses (
                    id, name, email, phone, address, gst_number, status, type, 
                    settings, created_at, updated_at
                ) VALUES (
                    :id, :name, :email, :phone, :address, :gst_number, :status, :type,
                    :settings::jsonb, :created_at, :updated_at
                ) ON CONFLICT (id) DO NOTHING`,
                { replacements: business }
            );

            this.log(`Migrated business: ${business.name} (${businessId})`, 'success');
        } catch (error) {
            this.log(`Failed to migrate business ${businessId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Migrate outlets for a business
     */
    async migrateOutlets(businessId, schemaName) {
        try {
            const [outlets] = await sequelize.query(
                `SELECT * FROM public.outlets WHERE business_id = :businessId`,
                { replacements: { businessId } }
            );

            for (const outlet of outlets) {
                if (this.dryRun) {
                    this.log(`[DRY RUN] Would migrate outlet ${outlet.id}`, 'info');
                    continue;
                }

                await sequelize.query(
                    `INSERT INTO "${schemaName}".outlets (
                        id, business_id, name, address, is_head_office, is_active, created_at, updated_at
                    ) VALUES (
                        :id, :business_id, :name, :address, :is_head_office, :is_active, :created_at, :updated_at
                    ) ON CONFLICT (id) DO NOTHING`,
                    { replacements: outlet }
                );
            }

            this.log(`Migrated ${outlets.length} outlets for business ${businessId}`, 'success');
        } catch (error) {
            this.log(`Failed to migrate outlets for ${businessId}: ${error.message}`, 'error');
        }
    }

    /**
     * Migrate users for a business
     */
    async migrateUsers(businessId, schemaName) {
        try {
            const [users] = await sequelize.query(
                `SELECT * FROM public.users WHERE business_id = :businessId`,
                { replacements: { businessId } }
            );

            for (const user of users) {
                if (this.dryRun) {
                    this.log(`[DRY RUN] Would migrate user ${user.id}`, 'info');
                    continue;
                }

                await sequelize.query(
                    `INSERT INTO "${schemaName}".users (
                        id, business_id, name, email, password_hash, role, primary_outlet_id,
                        is_active, token_version, last_login, created_at, updated_at
                    ) VALUES (
                        :id, :business_id, :name, :email, :password, :role, :outlet_id,
                        :is_active, :token_version, :last_login, :created_at, :updated_at
                    ) ON CONFLICT (id) DO NOTHING`,
                    { replacements: user }
                );
            }

            this.log(`Migrated ${users.length} users for business ${businessId}`, 'success');
        } catch (error) {
            this.log(`Failed to migrate users for ${businessId}: ${error.message}`, 'error');
        }
    }

    /**
     * Migrate products for a business
     */
    async migrateProducts(businessId, schemaName) {
        try {
            const [products] = await sequelize.query(
                `SELECT * FROM public.products WHERE business_id = :businessId`,
                { replacements: { businessId } }
            );

            for (const product of products) {
                if (this.dryRun) {
                    this.log(`[DRY RUN] Would migrate product ${product.id}`, 'info');
                    continue;
                }

                await sequelize.query(
                    `INSERT INTO "${schemaName}".products (
                        id, business_id, outlet_id, category_id, name, description, price, cost,
                        sku, barcode, image, product_type, is_available, track_stock, stock,
                        min_stock_level, max_stock_level, unit, tax_rate, created_at, updated_at
                    ) VALUES (
                        :id, :business_id, :outlet_id, :category_id, :name, :description, :price, :cost,
                        :sku, :barcode, :image, :product_type, :is_available, :track_stock, :stock,
                        :min_stock_level, :max_stock_level, :unit, :tax_rate, :created_at, :updated_at
                    ) ON CONFLICT (id) DO NOTHING`,
                    { replacements: product }
                );
            }

            this.log(`Migrated ${products.length} products for business ${businessId}`, 'success');
        } catch (error) {
            this.log(`Failed to migrate products for ${businessId}: ${error.message}`, 'error');
        }
    }

    /**
     * Migrate categories for a business
     */
    async migrateCategories(businessId, schemaName) {
        try {
            const [categories] = await sequelize.query(
                `SELECT * FROM public.categories WHERE business_id = :businessId`,
                { replacements: { businessId } }
            );

            for (const category of categories) {
                if (this.dryRun) {
                    this.log(`[DRY RUN] Would migrate category ${category.id}`, 'info');
                    continue;
                }

                await sequelize.query(
                    `INSERT INTO "${schemaName}".categories (
                        id, business_id, outlet_id, name, description, color, image, is_enabled, sort_order, created_at, updated_at
                    ) VALUES (
                        :id, :business_id, :outlet_id, :name, :description, :color, :image, :is_enabled, :sort_order, :created_at, :updated_at
                    ) ON CONFLICT (id) DO NOTHING`,
                    { replacements: category }
                );
            }

            this.log(`Migrated ${categories.length} categories for business ${businessId}`, 'success');
        } catch (error) {
            this.log(`Failed to migrate categories for ${businessId}: ${error.message}`, 'error');
        }
    }

    /**
     * Main migration orchestrator
     */
    async runMigration() {
        this.log('========================================', 'info');
        this.log('SCHEMA-PER-TENANT MIGRATION STARTED', 'info');
        this.log('========================================', 'info');

        if (this.dryRun) {
            this.log('🧪 DRY RUN MODE - No changes will be made', 'warning');
        }

        try {
            // Get all businesses
            const businesses = await this.getBusinesses();
            this.log(`Found ${businesses.length} businesses to process`, 'info');

            // Process each business
            for (const business of businesses) {
                this.log(`----------------------------------------`, 'info');
                this.log(`Processing business: ${business.name} (${business.id})`, 'progress');

                try {
                    // Step 1: Create schema and tables
                    const schemaName = await this.createTenantSchemaAndTables(business.id);

                    // Step 2: Migrate data
                    await this.migrateBusinessData(business.id, schemaName);
                    await this.migrateOutlets(business.id, schemaName);
                    await this.migrateUsers(business.id, schemaName);
                    await this.migrateCategories(business.id, schemaName);
                    await this.migrateProducts(business.id, schemaName);

                    this.log(`✅ Completed migration for: ${business.name}`, 'success');
                } catch (error) {
                    this.errors.push({ business: business.id, error: error.message });
                    this.log(`❌ Failed to migrate ${business.name}: ${error.message}`, 'error');
                }
            }

            // Summary
            this.log('========================================', 'info');
            this.log('MIGRATION SUMMARY', 'info');
            this.log('========================================', 'info');
            this.log(`Total businesses: ${businesses.length}`, 'info');
            this.log(`Successful: ${businesses.length - this.errors.length}`, 'success');
            this.log(`Failed: ${this.errors.length}`, this.errors.length > 0 ? 'error' : 'info');

            if (this.errors.length > 0) {
                this.log('\nErrors:', 'error');
                this.errors.forEach(e => {
                    this.log(`  - ${e.business}: ${e.error}`, 'error');
                });
            }

            this.log('\n✅ Migration completed!', 'success');
            
            if (!this.dryRun) {
                this.log('\n⚠️  IMPORTANT NEXT STEPS:', 'warning');
                this.log('1. Verify data in tenant schemas with verification script', 'info');
                this.log('2. Lock public tables to prevent new writes', 'info');
                this.log('3. Test tenant isolation thoroughly', 'info');
            }

        } catch (error) {
            this.log(`Migration failed: ${error.message}`, 'error');
            throw error;
        } finally {
            // Reset search path
            await sequelize.query('SET search_path TO public');
        }
    }
}

// Run if called directly
if (require.main === module) {
    const service = new SchemaMigrationService();
    service.runMigration()
        .then(() => {
            console.log('\n✅ Script completed');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = SchemaMigrationService;
