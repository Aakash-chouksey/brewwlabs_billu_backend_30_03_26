#!/usr/bin/env node
/**
 * 🔍 FULL SYSTEM AUDIT SCRIPT
 * Comprehensive verification of multi-tenant SaaS system
 * 
 * This script performs end-to-end verification of:
 * 1. Control plane data integrity
 * 2. Tenant schema completeness
 * 3. Data consistency
 * 4. API readiness
 * 5. Migration status
 */

const { sequelize } = require('../config/unified_database');
const { Sequelize } = require('sequelize');
const tenantModelLoader = require('../src/architecture/tenantModelLoader');
const migrationRunner = require('../src/architecture/migrationRunner');
const { CONTROL_MODELS, TENANT_MODELS } = require('../src/utils/constants');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

class FullSystemAudit {
    constructor() {
        this.issues = [];
        this.warnings = [];
        this.successes = [];
        this.startTime = Date.now();
        this.auditResults = {
            controlPlane: { status: 'PENDING', checks: {} },
            tenantSchemas: { status: 'PENDING', schemas: [] },
            migrations: { status: 'PENDING', details: {} },
            dataIntegrity: { status: 'PENDING', issues: [] },
            apiReadiness: { status: 'PENDING', endpoints: {} }
        };
    }

    log(level, message, details = null) {
        const timestamp = new Date().toISOString();
        const prefix = {
            info: `${colors.cyan}[INFO]${colors.reset}`,
            success: `${colors.green}[✓]${colors.reset}`,
            warning: `${colors.yellow}[⚠]${colors.reset}`,
            error: `${colors.red}[✗]${colors.reset}`,
            section: `${colors.magenta}[▶]${colors.reset}`,
            debug: `${colors.blue}[DBG]${colors.reset}`
        }[level] || `[${level.toUpperCase()}]`;

        console.log(`${prefix} ${message}`);
        if (details) {
            console.log(`${colors.blue}  ↳${colors.reset}`, details);
        }
    }

    async run() {
        console.log(`\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}`);
        console.log(`${colors.bright}${colors.magenta}           FULL SYSTEM AUDIT - Multi-Tenant POS${colors.reset}`);
        console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

        try {
            // Step 1: Verify database connection
            await this.verifyDatabaseConnection();

            // Step 2: Verify control plane tables
            await this.verifyControlPlaneTables();

            // Step 3: Verify control plane data
            await this.verifyControlPlaneData();

            // Step 4: Verify tenant schemas
            await this.verifyTenantSchemas();

            // Step 5: Verify data integrity
            await this.verifyDataIntegrity();

            // Step 6: Verify API readiness
            await this.verifyApiReadiness();

            // Step 7: Run comprehensive report
            await this.generateReport();

        } catch (error) {
            this.log('error', 'Audit failed with critical error:', error.message);
            console.error(error.stack);
            process.exit(1);
        } finally {
            await sequelize.close();
        }
    }

    async verifyDatabaseConnection() {
        this.log('section', 'STEP 1: Database Connection Verification');
        try {
            await sequelize.authenticate();
            const [result] = await sequelize.query('SELECT version()', { type: Sequelize.QueryTypes.SELECT });
            this.log('success', 'Database connection successful', result?.version?.substring(0, 50));
            this.auditResults.database = { connected: true, version: result?.version };
        } catch (error) {
            this.log('error', 'Database connection failed', error.message);
            throw error;
        }
    }

    async verifyControlPlaneTables() {
        this.log('section', 'STEP 2: Control Plane Tables Verification');
        
        const requiredTables = [
            'businesses', 'users', 'tenant_registry', 
            'subscriptions', 'plans', 'audit_logs'
        ];
        
        const existingTables = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
        `, { type: Sequelize.QueryTypes.SELECT });

        const tableNames = existingTables.map(t => t.table_name);
        
        for (const table of requiredTables) {
            if (tableNames.includes(table)) {
                this.log('success', `Control plane table exists: ${table}`);
                this.auditResults.controlPlane.checks[table] = { exists: true };
            } else {
                this.log('warning', `Missing control plane table: ${table}`);
                this.issues.push(`Missing control plane table: ${table}`);
                this.auditResults.controlPlane.checks[table] = { exists: false };
            }
        }
    }

    async verifyControlPlaneData() {
        this.log('section', 'STEP 3: Control Plane Data Verification');
        
        try {
            // Check businesses
            const businesses = await sequelize.query(
                'SELECT id, name, email, status, owner_id FROM public.businesses',
                { type: Sequelize.QueryTypes.SELECT }
            );
            this.log('info', `Found ${businesses.length} businesses in control plane`);
            
            for (const biz of businesses) {
                const checks = {
                    hasId: !!biz.id,
                    hasName: !!biz.name,
                    hasEmail: !!biz.email,
                    hasValidStatus: ['active', 'inactive', 'suspended'].includes(biz.status)
                };
                
                const allValid = Object.values(checks).every(v => v);
                if (allValid) {
                    this.log('success', `Business valid: ${biz.name} (${biz.id?.substring(0, 8)}...)`);
                } else {
                    this.log('error', `Business invalid: ${biz.id}`, checks);
                    this.issues.push(`Invalid business record: ${biz.id}`);
                }
            }

            // Check users
            const users = await sequelize.query(
                'SELECT id, email, business_id, role, status FROM public.users',
                { type: Sequelize.QueryTypes.SELECT }
            );
            this.log('info', `Found ${users.length} users in control plane`);

            // Validate user-business relationships
            const businessIds = new Set(businesses.map(b => b.id));
            for (const user of users) {
                const hasValidBusiness = businessIds.has(user.business_id);
                if (!hasValidBusiness) {
                    this.log('error', `Orphaned user: ${user.email} -> invalid business_id: ${user.business_id}`);
                    this.issues.push(`User ${user.id} has invalid business_id ${user.business_id}`);
                }
            }

            // Check tenant_registry
            const registries = await sequelize.query(
                'SELECT id, business_id, schema_name, status FROM public.tenant_registry',
                { type: Sequelize.QueryTypes.SELECT }
            );
            this.log('info', `Found ${registries.length} tenant registry entries`);

            // Validate registry entries
            for (const reg of registries) {
                const checks = {
                    hasId: !!reg.id,
                    hasBusinessId: !!reg.business_id,
                    hasSchemaName: !!reg.schema_name,
                    hasValidStatus: ['CREATING', 'READY', 'init_failed', 'migrating'].includes(reg.status),
                    businessExists: businessIds.has(reg.business_id)
                };

                if (!checks.businessExists) {
                    this.log('error', `Orphaned registry entry: ${reg.schema_name} -> invalid business_id`);
                    this.issues.push(`Registry ${reg.id} references non-existent business ${reg.business_id}`);
                }

                if (!checks.hasSchemaName || !reg.schema_name.startsWith('tenant_')) {
                    this.log('error', `Invalid schema name in registry: ${reg.schema_name}`);
                    this.issues.push(`Registry ${reg.id} has invalid schema_name: ${reg.schema_name}`);
                }
            }

            this.auditResults.controlPlane = {
                status: this.issues.length === 0 ? 'VALID' : 'INVALID',
                businessCount: businesses.length,
                userCount: users.length,
                registryCount: registries.length,
                orphanedUsers: users.filter(u => !businessIds.has(u.business_id)).length,
                orphanedRegistries: registries.filter(r => !businessIds.has(r.business_id)).length
            };

        } catch (error) {
            this.log('error', 'Control plane data verification failed', error.message);
            this.issues.push(`Control plane verification error: ${error.message}`);
        }
    }

    async verifyTenantSchemas() {
        this.log('section', 'STEP 4: Tenant Schema Verification');

        try {
            // Get all tenant schemas
            const schemas = await sequelize.query(`
                SELECT schema_name 
                FROM information_schema.schemata 
                WHERE schema_name LIKE 'tenant_%'
            `, { type: Sequelize.QueryTypes.SELECT });

            this.log('info', `Found ${schemas.length} tenant schemas`);

            const criticalTables = [
                'schema_versions', 'outlets', 'products', 'orders', 
                'order_items', 'inventory_items', 'categories', 'settings'
            ];

            for (const schema of schemas) {
                const schemaName = schema.schema_name;
                const businessId = schemaName.replace('tenant_', '');

                // Get tables in schema
                const tables = await sequelize.query(`
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = :schema
                    AND table_type = 'BASE TABLE'
                `, { 
                    replacements: { schema: schemaName },
                    type: Sequelize.QueryTypes.SELECT 
                });

                const tableNames = tables.map(t => t.table_name);
                const missingTables = criticalTables.filter(t => !tableNames.includes(t));

                // Check for control plane tables in tenant schema (WRONG!)
                const wrongTables = tableNames.filter(t => 
                    ['businesses', 'users', 'tenant_registry'].includes(t)
                );

                const schemaStatus = {
                    name: schemaName,
                    tableCount: tables.length,
                    missingTables,
                    wrongTables,
                    isComplete: missingTables.length === 0 && wrongTables.length === 0
                };

                if (missingTables.length > 0) {
                    this.log('error', `Schema ${schemaName} missing tables:`, missingTables.join(', '));
                    this.issues.push(`Schema ${schemaName} missing: ${missingTables.join(', ')}`);
                }

                if (wrongTables.length > 0) {
                    this.log('error', `Schema ${schemaName} has WRONG tables:`, wrongTables.join(', '));
                    this.issues.push(`Schema ${schemaName} contains control tables: ${wrongTables.join(', ')}`);
                }

                if (schemaStatus.isComplete) {
                    this.log('success', `Schema ${schemaName} is complete (${tables.length} tables)`);
                }

                this.auditResults.tenantSchemas.schemas.push(schemaStatus);
            }

            const completeSchemas = this.auditResults.tenantSchemas.schemas.filter(s => s.isComplete).length;
            this.auditResults.tenantSchemas.status = completeSchemas === schemas.length ? 'COMPLETE' : 'INCOMPLETE';
            this.auditResults.tenantSchemas.total = schemas.length;
            this.auditResults.tenantSchemas.complete = completeSchemas;

        } catch (error) {
            this.log('error', 'Tenant schema verification failed', error.message);
            this.issues.push(`Tenant schema verification error: ${error.message}`);
        }
    }

    async verifyDataIntegrity() {
        this.log('section', 'STEP 5: Data Integrity Verification');

        try {
            const schemas = await sequelize.query(`
                SELECT schema_name 
                FROM information_schema.schemata 
                WHERE schema_name LIKE 'tenant_%'
            `, { type: Sequelize.QueryTypes.SELECT });

            for (const schema of schemas) {
                const schemaName = schema.schema_name;

                // Check schema_versions
                const versions = await sequelize.query(`
                    SELECT version, migration_name, applied_at 
                    FROM "${schemaName}"."schema_versions"
                    ORDER BY version DESC
                `, { type: Sequelize.QueryTypes.SELECT });

                if (versions.length === 0) {
                    this.log('error', `Schema ${schemaName} has NO schema_versions!`);
                    this.issues.push(`${schemaName}: Missing schema_versions data`);
                } else {
                    const maxVersion = Math.max(...versions.map(v => v.version));
                    this.log('info', `Schema ${schemaName} at version ${maxVersion}`);
                }

                // Check outlets
                const outlets = await sequelize.query(`
                    SELECT id, name, business_id, status 
                    FROM "${schemaName}"."outlets"
                `, { type: Sequelize.QueryTypes.SELECT });

                if (outlets.length === 0) {
                    this.log('error', `Schema ${schemaName} has NO outlets!`);
                    this.issues.push(`${schemaName}: Missing outlets (at least 1 required)`);
                } else {
                    this.log('success', `Schema ${schemaName} has ${outlets.length} outlet(s)`);
                }

                // Check for NULL business_id in critical tables
                const tablesWithBusinessId = ['outlets', 'products', 'orders', 'categories'];
                for (const table of tablesWithBusinessId) {
                    if (table === 'schema_versions') continue;
                    
                    try {
                        const nullBizCount = await sequelize.query(`
                            SELECT COUNT(*) as count 
                            FROM "${schemaName}"."${table}" 
                            WHERE business_id IS NULL
                        `, { type: Sequelize.QueryTypes.SELECT });

                        if (nullBizCount[0]?.count > 0) {
                            this.log('warning', `${schemaName}.${table}: ${nullBizCount[0].count} rows with NULL business_id`);
                            this.warnings.push(`${schemaName}.${table}: NULL business_id found`);
                        }
                    } catch (e) {
                        // Table might not exist
                    }
                }
            }

        } catch (error) {
            this.log('error', 'Data integrity verification failed', error.message);
            this.issues.push(`Data integrity error: ${error.message}`);
        }
    }

    async verifyApiReadiness() {
        this.log('section', 'STEP 6: API Readiness Verification');

        // Check model availability
        const { ModelFactory } = require('../src/architecture/modelFactory');
        const models = await ModelFactory.createModels(sequelize);

        const requiredModels = [
            ...CONTROL_MODELS,
            ...TENANT_MODELS
        ];

        const missingModels = requiredModels.filter(m => !models[m]);
        
        if (missingModels.length > 0) {
            this.log('error', 'Missing models:', missingModels.join(', '));
            this.issues.push(`Missing models: ${missingModels.join(', ')}`);
        } else {
            this.log('success', `All ${requiredModels.length} models available`);
        }

        // Check migration runner
        try {
            const testSchema = 'tenant_test_api_readiness';
            await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${testSchema}"`);
            await sequelize.query(`
                CREATE TABLE IF NOT EXISTS "${testSchema}"."schema_versions" (
                    version INTEGER PRIMARY KEY,
                    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            `);
            
            const version = await migrationRunner.getCurrentVersion(testSchema);
            this.log('success', `Migration runner functional (test schema at v${version})`);
            
            await sequelize.query(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`);
        } catch (error) {
            this.log('error', 'Migration runner check failed', error.message);
            this.issues.push(`Migration runner error: ${error.message}`);
        }

        this.auditResults.apiReadiness = {
            modelsAvailable: Object.keys(models).length,
            missingModels: missingModels.length,
            status: missingModels.length === 0 ? 'READY' : 'NOT_READY'
        };
    }

    async generateReport() {
        this.log('section', '═══════════════════════════════════════════════════════════════');
        this.log('section', '                    FINAL AUDIT REPORT');
        this.log('section', '═══════════════════════════════════════════════════════════════');

        const duration = Date.now() - this.startTime;
        
        console.log(`\n${colors.bright}📊 Control Plane:${colors.reset}`);
        console.log(`   Status: ${this.auditResults.controlPlane.status === 'VALID' ? colors.green + '✓ VALID' : colors.red + '✗ INVALID'}${colors.reset}`);
        console.log(`   Businesses: ${this.auditResults.controlPlane.businessCount || 0}`);
        console.log(`   Users: ${this.auditResults.controlPlane.userCount || 0}`);
        console.log(`   Registries: ${this.auditResults.controlPlane.registryCount || 0}`);

        console.log(`\n${colors.bright}🏢 Tenant Schemas:${colors.reset}`);
        console.log(`   Status: ${this.auditResults.tenantSchemas.status === 'COMPLETE' ? colors.green + '✓ COMPLETE' : colors.yellow + '⚠ INCOMPLETE'}${colors.reset}`);
        console.log(`   Total: ${this.auditResults.tenantSchemas.total || 0}`);
        console.log(`   Complete: ${this.auditResults.tenantSchemas.complete || 0}`);

        console.log(`\n${colors.bright}🔧 Issues Found: ${this.issues.length}${colors.reset}`);
        if (this.issues.length > 0) {
            this.issues.forEach((issue, i) => {
                console.log(`   ${colors.red}${i + 1}. ${issue}${colors.reset}`);
            });
        } else {
            console.log(`   ${colors.green}None - System is clean!${colors.reset}`);
        }

        console.log(`\n${colors.bright}⚠️ Warnings: ${this.warnings.length}${colors.reset}`);
        if (this.warnings.length > 0) {
            this.warnings.forEach((warning, i) => {
                console.log(`   ${colors.yellow}${i + 1}. ${warning}${colors.reset}`);
            });
        }

        console.log(`\n${colors.bright}⏱️ Duration: ${duration}ms${colors.reset}`);

        // Final verdict
        const hasCriticalIssues = this.issues.length > 0;
        const hasWarnings = this.warnings.length > 0;

        console.log(`\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}`);
        if (!hasCriticalIssues && !hasWarnings) {
            console.log(`${colors.bright}${colors.green}              ✅ SYSTEM FULLY STABLE${colors.reset}`);
        } else if (!hasCriticalIssues && hasWarnings) {
            console.log(`${colors.bright}${colors.yellow}              ⚠️  STABLE WITH WARNINGS${colors.reset}`);
        } else {
            console.log(`${colors.bright}${colors.red}              ❌ SYSTEM NEEDS FIXES${colors.reset}`);
        }
        console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

        // Write detailed JSON report
        const reportPath = `./audit-report-${new Date().toISOString().split('T')[0]}.json`;
        const fs = require('fs');
        fs.writeFileSync(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            duration: duration,
            summary: {
                controlPlane: this.auditResults.controlPlane,
                tenantSchemas: this.auditResults.tenantSchemas,
                apiReadiness: this.auditResults.apiReadiness
            },
            issues: this.issues,
            warnings: this.warnings,
            status: hasCriticalIssues ? 'NEEDS_FIXES' : (hasWarnings ? 'STABLE_WITH_WARNINGS' : 'FULLY_STABLE')
        }, null, 2));

        this.log('info', `Detailed report saved to: ${reportPath}`);

        return {
            status: hasCriticalIssues ? 'NEEDS_FIXES' : (hasWarnings ? 'STABLE_WITH_WARNINGS' : 'FULLY_STABLE'),
            issues: this.issues,
            warnings: this.warnings
        };
    }
}

// Run if called directly
if (require.main === module) {
    const audit = new FullSystemAudit();
    audit.run().then(result => {
        const exitCode = result && result.status === 'FULLY_STABLE' ? 0 : 1;
        process.exit(exitCode);
    }).catch(error => {
        console.error('Audit failed:', error);
        process.exit(1);
    });
}

module.exports = FullSystemAudit;
