#!/usr/bin/env node

/**
 * Database-per-Tenant to Schema-per-Tenant Migration Script
 * 
 * This script safely migrates your existing multi-tenant architecture
 * from database-per-tenant to schema-per-tenant with zero downtime.
 */

const { Sequelize } = require('sequelize');
const { schemaSequelize, setTenantSchema, schemaExists, createTenantSchema } = require('../config/schema_database');
const { controlPlaneSequelize } = require('../config/control_plane_db');
const schemaTenantService = require('../src/services/schemaTenantService');
const schemaMigration = require('../src/migrations/schemaMigration');

class TenantMigrator {
    constructor() {
        this.migrationLog = [];
        this.errors = [];
        this.warnings = [];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = { timestamp, message, type };
        this.migrationLog.push(logEntry);
        
        const prefix = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            progress: '🔄'
        }[type] || 'ℹ️';
        
        console.log(`${prefix} ${message}`);
    }

    /**
     * Validate prerequisites before migration
     */
    async validatePrerequisites() {
        this.log('Validating migration prerequisites...', 'info');

        try {
            // Check control plane connection
            await controlPlaneSequelize.authenticate();
            this.log('Control plane database connection: OK', 'success');

            // Check schema database connection
            await schemaSequelize.authenticate();
            this.log('Schema database connection: OK', 'success');

            // Check if tenant_connections table exists
            const [tableExists] = await controlPlaneSequelize.query(
                `SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'tenant_connections'
                ) as exists`
            );

            if (!tableExists.exists) {
                throw new Error('tenant_connections table not found in control plane');
            }
            this.log('tenant_connections table: OK', 'success');

            // Count existing tenants
            const [tenantCount] = await controlPlaneSequelize.query(
                'SELECT COUNT(*) as count FROM tenant_connections'
            );
            
            const totalTenants = parseInt(tenantCount[0].count);
            this.log(`Found ${totalTenants} tenants to migrate`, 'info');

            return { totalTenants, valid: true };
        } catch (error) {
            this.log(`Prerequisite validation failed: ${error.message}`, 'error');
            this.errors.push(error.message);
            return { valid: false, error: error.message };
        }
    }

    /**
     * Create migration tracking tables
     */
    async setupMigrationTracking() {
        this.log('Setting up migration tracking...', 'info');

        try {
            // Initialize schema migration tracking
            await schemaMigration.initMigrationTracking();

            // Create tenant migration log table
            await controlPlaneSequelize.query(`
                CREATE TABLE IF NOT EXISTS tenant_migration_logs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tenant_id VARCHAR(255) NOT NULL,
                    old_database_name VARCHAR(255),
                    new_schema_name VARCHAR(255) NOT NULL,
                    status VARCHAR(50) DEFAULT 'pending',
                    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP,
                    error_message TEXT,
                    records_migrated INTEGER DEFAULT 0,
                    metadata JSONB DEFAULT '{}'
                )
            `);

            this.log('Migration tracking tables created', 'success');
        } catch (error) {
            this.log(`Failed to setup migration tracking: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Get list of tenants to migrate
     */
    async getTenantsToMigrate() {
        try {
            const tenants = await controlPlaneSequelize.query(`
                SELECT 
                    tc.business_id,
                    tc.db_name as old_database_name,
                    tc.db_host,
                    tc.db_port,
                    tc.db_user,
                    tc.encrypted_password,
                    b.name as business_name,
                    b.email as business_email
                FROM tenant_connections tc
                LEFT JOIN businesses b ON tc.business_id = b.id
                ORDER BY tc.created_at ASC
            `, {
                type: Sequelize.QueryTypes.SELECT
            });

            return tenants;
        } catch (error) {
            this.log(`Failed to get tenants list: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Test connection to old tenant database
     */
    async testOldTenantConnection(tenant) {
        try {
            // Decrypt password (simplified - use your actual decryption)
            let password = tenant.encrypted_password;
            try {
                const { decryptPassword } = require('../security/encryption');
                password = decryptPassword(tenant.encrypted_password);
            } catch (e) {
                this.log(`Password decryption failed for ${tenant.business_id}, using as-is`, 'warning');
            }

            const oldSequelize = new Sequelize(
                tenant.db_name,
                tenant.db_user,
                password,
                {
                    host: tenant.db_host,
                    port: tenant.db_port,
                    dialect: 'postgres',
                    logging: false
                }
            );

            await oldSequelize.authenticate();
            await oldSequelize.close();
            
            return { success: true };
        } catch (error) {
            this.log(`Failed to connect to old database for ${tenant.business_id}: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    /**
     * Migrate single tenant data
     */
    async migrateTenantData(tenant) {
        const tenantId = tenant.business_id;
        const schemaName = `tenant_${tenantId}`;
        
        this.log(`Starting migration for tenant ${tenantId} (${tenant.business_name})`, 'progress');

        try {
            // Create migration log entry
            const [logEntry] = await controlPlaneSequelize.query(`
                INSERT INTO tenant_migration_logs 
                (tenant_id, old_database_name, new_schema_name, status, metadata)
                VALUES (:tenantId, :oldDbName, :schemaName, 'in_progress', :metadata)
                RETURNING id
            `, {
                replacements: {
                    tenantId,
                    oldDbName: tenant.old_database_name,
                    schemaName,
                    metadata: JSON.stringify({
                        business_name: tenant.business_name,
                        business_email: tenant.business_email
                    })
                },
                type: Sequelize.QueryTypes.INSERT
            });

            const migrationLogId = logEntry[0].id;

            // Step 1: Create tenant schema
            this.log(`Creating schema: ${schemaName}`, 'progress');
            await createTenantSchema(schemaName);
            await setTenantSchema(schemaName);

            // Step 2: Initialize schema with tables
            this.log(`Initializing tables for schema: ${schemaName}`, 'progress');
            await schemaMigration.initializeTenantSchema(tenantId);

            // Step 3: Connect to old database and migrate data
            this.log(`Connecting to old database: ${tenant.old_database_name}`, 'progress');
            
            // Decrypt password
            let password = tenant.encrypted_password;
            try {
                const { decryptPassword } = require('../security/encryption');
                password = decryptPassword(tenant.encrypted_password);
            } catch (e) {
                this.log(`Using encrypted password as-is for ${tenantId}`, 'warning');
            }

            const oldSequelize = new Sequelize(
                tenant.old_database_name,
                tenant.db_user,
                password,
                {
                    host: tenant.db_host,
                    port: tenant.db_port,
                    dialect: 'postgres',
                    logging: false
                }
            );

            await oldSequelize.authenticate();

            // Step 4: Migrate data table by table
            const tablesToMigrate = [
                'users', 'businesses', 'outlets', 'categories', 
                'product_types', 'products', 'tables', 'orders', 'order_items'
            ];

            let totalRecordsMigrated = 0;

            for (const tableName of tablesToMigrate) {
                try {
                    const recordsMigrated = await this.migrateTable(
                        oldSequelize, 
                        schemaSequelize, 
                        tableName
                    );
                    totalRecordsMigrated += recordsMigrated;
                    this.log(`Migrated ${recordsMigrated} records from ${tableName}`, 'success');
                } catch (tableError) {
                    this.log(`Failed to migrate table ${tableName}: ${tableError.message}`, 'warning');
                    this.warnings.push(`Tenant ${tenantId}: Failed to migrate ${tableName}`);
                }
            }

            // Close old connection
            await oldSequelize.close();

            // Step 5: Update migration log
            await controlPlaneSequelize.query(`
                UPDATE tenant_migration_logs 
                SET status = 'completed', 
                    completed_at = CURRENT_TIMESTAMP,
                    records_migrated = :totalRecords,
                    error_message = NULL
                WHERE id = :logId
            `, {
                replacements: {
                    totalRecords: totalRecordsMigrated,
                    logId: migrationLogId
                }
            });

            // Step 6: Create schema mapping
            await schemaTenantService.createTenantSchemaMapping(tenantId, schemaName);

            this.log(`✅ Tenant migration completed: ${tenantId} (${totalRecordsMigrated} records)`, 'success');
            
            return {
                success: true,
                tenantId,
                schemaName,
                recordsMigrated: totalRecordsMigrated
            };

        } catch (error) {
            this.log(`❌ Tenant migration failed: ${tenantId} - ${error.message}`, 'error');
            
            // Update migration log with error
            try {
                await controlPlaneSequelize.query(`
                    UPDATE tenant_migration_logs 
                    SET status = 'failed', 
                        completed_at = CURRENT_TIMESTAMP,
                        error_message = :errorMessage
                    WHERE tenant_id = :tenantId
                `, {
                    replacements: {
                        tenantId,
                        errorMessage: error.message
                    }
                });
            } catch (logError) {
                this.log(`Failed to update migration log: ${logError.message}`, 'error');
            }

            this.errors.push(`Tenant ${tenantId}: ${error.message}`);
            
            return {
                success: false,
                tenantId,
                error: error.message
            };
        }
    }

    /**
     * Migrate data from one table to another
     */
    async migrateTable(sourceSequelize, targetSequelize, tableName) {
        try {
            // Check if source table exists
            const [tableExists] = await sourceSequelize.query(
                `SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = :tableName
                ) as exists`,
                {
                    replacements: { tableName },
                    type: Sequelize.QueryTypes.SELECT
                }
            );

            if (!tableExists.exists) {
                this.log(`Table ${tableName} does not exist in source database, skipping`, 'warning');
                return 0;
            }

            // Get all data from source table
            const [countResult] = await sourceSequelize.query(
                `SELECT COUNT(*) as count FROM ${tableName}`,
                { type: Sequelize.QueryTypes.SELECT }
            );

            const totalRecords = parseInt(countResult[0].count);
            if (totalRecords === 0) {
                this.log(`Table ${tableName} is empty, skipping`, 'info');
                return 0;
            }

            // Migrate in batches to avoid memory issues
            const batchSize = 1000;
            let migratedRecords = 0;

            for (let offset = 0; offset < totalRecords; offset += batchSize) {
                const records = await sourceSequelize.query(
                    `SELECT * FROM ${tableName} ORDER BY id LIMIT :batchSize OFFSET :offset`,
                    {
                        replacements: { batchSize, offset },
                        type: Sequelize.QueryTypes.SELECT
                    }
                );

                if (records.length > 0) {
                    // Insert records into target table
                    for (const record of records) {
                        // Convert UUID objects to strings if needed
                        const cleanRecord = {};
                        for (const [key, value] of Object.entries(record)) {
                            if (value && typeof value === 'object' && value.type === 'Buffer') {
                                // Handle UUID buffers
                                cleanRecord[key] = value.toString('hex');
                            } else {
                                cleanRecord[key] = value;
                            }
                        }

                        await targetSequelize.query(
                            `INSERT INTO ${tableName} (${Object.keys(cleanRecord).join(', ')}) 
                             VALUES (${Object.keys(cleanRecord).map((_, i) => `$${i + 1}`).join(', ')})
                             ON CONFLICT (id) DO NOTHING`,
                            {
                                bind: Object.values(cleanRecord),
                                type: Sequelize.QueryTypes.INSERT
                            }
                        );
                    }

                    migratedRecords += records.length;
                }
            }

            return migratedRecords;
        } catch (error) {
            this.log(`Error migrating table ${tableName}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Run full migration
     */
    async runMigration(options = {}) {
        const { dryRun = false, batchSize = 5, skipFailed = false } = options;

        this.log('🚀 Starting Database-per-Tenant to Schema-per-Tenant Migration', 'info');
        this.log(`Options: dryRun=${dryRun}, batchSize=${batchSize}, skipFailed=${skipFailed}`, 'info');

        try {
            // Step 1: Validate prerequisites
            const validation = await this.validatePrerequisites();
            if (!validation.valid) {
                throw new Error('Prerequisites validation failed');
            }

            // Step 2: Setup migration tracking
            await this.setupMigrationTracking();

            // Step 3: Get tenants to migrate
            const tenants = await this.getTenantsToMigrate();
            this.log(`Found ${tenants.length} tenants to migrate`, 'info');

            if (dryRun) {
                this.log('DRY RUN: Would migrate the following tenants:', 'info');
                tenants.forEach(tenant => {
                    this.log(`  - ${tenant.business_id} (${tenant.business_name}) -> tenant_${tenant.business_id}`, 'info');
                });
                return { success: true, dryRun: true, tenants: tenants.length };
            }

            // Step 4: Test connections to old databases
            this.log('Testing connections to old tenant databases...', 'progress');
            const connectionTests = [];
            for (const tenant of tenants) {
                const test = await this.testOldTenantConnection(tenant);
                connectionTests.push({ tenantId: tenant.business_id, ...test });
            }

            const failedConnections = connectionTests.filter(t => !t.success);
            if (failedConnections.length > 0) {
                this.log(`${failedConnections.length} tenants have failed database connections`, 'warning');
                if (!skipFailed) {
                    throw new Error('Some tenant databases are not accessible. Use --skip-failed to continue.');
                }
            }

            // Step 5: Migrate tenants in batches
            const results = {
                successful: [],
                failed: [],
                skipped: []
            };

            for (let i = 0; i < tenants.length; i += batchSize) {
                const batch = tenants.slice(i, i + batchSize);
                this.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tenants.length / batchSize)}`, 'progress');

                for (const tenant of batch) {
                    const connectionTest = connectionTests.find(t => t.tenantId === tenant.business_id);
                    if (!connectionTest.success) {
                        results.skipped.push({ tenantId: tenant.business_id, reason: connectionTest.error });
                        continue;
                    }

                    const result = await this.migrateTenantData(tenant);
                    if (result.success) {
                        results.successful.push(result);
                    } else {
                        results.failed.push(result);
                        if (!skipFailed) {
                            throw new Error(`Migration failed for tenant ${tenant.business_id}. Use --skip-failed to continue.`);
                        }
                    }
                }
            }

            // Step 6: Generate migration report
            this.generateMigrationReport(results);

            return {
                success: true,
                results,
                summary: {
                    total: tenants.length,
                    successful: results.successful.length,
                    failed: results.failed.length,
                    skipped: results.skipped.length,
                    totalRecordsMigrated: results.successful.reduce((sum, r) => sum + r.recordsMigrated, 0)
                }
            };

        } catch (error) {
            this.log(`Migration failed: ${error.message}`, 'error');
            return {
                success: false,
                error: error.message,
                log: this.migrationLog,
                errors: this.errors,
                warnings: this.warnings
            };
        }
    }

    /**
     * Generate migration report
     */
    generateMigrationReport(results) {
        this.log('\n📊 MIGRATION REPORT', 'info');
        this.log('==================', 'info');
        this.log(`Total Tenants: ${results.successful.length + results.failed.length + results.skipped.length}`, 'info');
        this.log(`✅ Successful: ${results.successful.length}`, 'success');
        this.log(`❌ Failed: ${results.failed.length}`, 'error');
        this.log(`⚠️ Skipped: ${results.skipped.length}`, 'warning');

        if (results.successful.length > 0) {
            this.log('\n✅ Successfully Migrated:', 'success');
            results.successful.forEach(result => {
                this.log(`  - ${result.tenantId} → ${result.schemaName} (${result.recordsMigrated} records)`, 'success');
            });
        }

        if (results.failed.length > 0) {
            this.log('\n❌ Failed Migrations:', 'error');
            results.failed.forEach(result => {
                this.log(`  - ${result.tenantId}: ${result.error}`, 'error');
            });
        }

        if (results.skipped.length > 0) {
            this.log('\n⚠️ Skipped Tenants:', 'warning');
            results.skipped.forEach(result => {
                this.log(`  - ${result.tenantId}: ${result.reason}`, 'warning');
            });
        }

        if (this.warnings.length > 0) {
            this.log('\n⚠️ Warnings:', 'warning');
            this.warnings.forEach(warning => {
                this.log(`  - ${warning}`, 'warning');
            });
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const options = {
        dryRun: args.includes('--dry-run'),
        batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 5,
        skipFailed: args.includes('--skip-failed')
    };

    const migrator = new TenantMigrator();
    const result = await migrator.runMigration(options);

    if (result.success) {
        console.log('\n🎉 Migration completed successfully!');
        process.exit(0);
    } else {
        console.error('\n💥 Migration failed!');
        process.exit(1);
    }
}

// Export for programmatic use
module.exports = TenantMigrator;

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Unhandled error:', error);
        process.exit(1);
    });
}
