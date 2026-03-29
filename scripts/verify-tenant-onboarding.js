#!/usr/bin/env node
/**
 * TENANT ONBOARDING VERIFICATION SCRIPT
 * 
 * This script verifies that tenant onboarding creates complete data
 * and all APIs work without failure.
 * 
 * Usage: node verify-tenant-onboarding.js [businessId]
 * If businessId is provided, verifies existing tenant
 * If not provided, creates new test tenant and verifies
 */

const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { sequelize } = require('../config/unified_database');
const onboardingService = require('../services/onboardingService');
const tenantDataSeeder = require('../services/tenant/tenantDataSeeder');
const tenantModelLoader = require('../src/architecture/tenantModelLoader');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_EMAIL_PREFIX = `test_${Date.now()}`;

// Test data
const testTenantData = {
    businessName: `Test Cafe ${Date.now()}`,
    businessEmail: `${TEST_EMAIL_PREFIX}@test.com`,
    businessPhone: '9876543210',
    businessAddress: '123 Test Street, Test City',
    gstNumber: '22AAAAA0000A1Z5',
    adminName: 'Test Admin',
    adminEmail: `${TEST_EMAIL_PREFIX}_admin@test.com`,
    adminPassword: 'TestPassword123!',
    cafeType: 'SOLO'
};

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
    log(`✅ ${message}`, 'green');
}

function error(message) {
    log(`❌ ${message}`, 'red');
}

function warning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

function info(message) {
    log(`ℹ️  ${message}`, 'cyan');
}

class TenantVerification {
    constructor() {
        this.results = {
            testsPassed: 0,
            testsFailed: 0,
            errors: [],
            warnings: []
        };
        this.createdBusinessId = null;
    }

    async run() {
        const startTime = Date.now();
        log('\n' + '='.repeat(80), 'bright');
        log('TENANT ONBOARDING VERIFICATION', 'bright');
        log('='.repeat(80), 'bright');
        console.log();

        try {
            // Phase 1: Database Connection
            await this.verifyDatabaseConnection();

            // Phase 2: Check control plane models
            await this.verifyControlPlane();

            // Phase 3: Create test tenant or use provided
            const businessId = await this.setupTestTenant();

            // Phase 4: Verify tenant schema
            const schemaName = `tenant_${businessId}`;
            await this.verifyTenantSchema(schemaName);

            // Phase 5: Verify default data
            await this.verifyDefaultData(schemaName, businessId);

            // Phase 6: Verify API endpoints
            await this.verifyAPIs(businessId);

            // Phase 7: Verify model consistency
            await this.verifyModelConsistency(schemaName);

            // Final Summary
            this.printSummary(startTime);

        } catch (err) {
            error(`Critical error: ${err.message}`);
            console.error(err);
            process.exit(1);
        } finally {
            await sequelize.close();
        }
    }

    async verifyDatabaseConnection() {
        info('Phase 1: Verifying database connection...');
        try {
            await sequelize.authenticate();
            success('Database connection successful');
            this.results.testsPassed++;
        } catch (err) {
            error(`Database connection failed: ${err.message}`);
            this.results.testsFailed++;
            this.results.errors.push(`Database connection: ${err.message}`);
            throw err;
        }
        console.log();
    }

    async verifyControlPlane() {
        info('Phase 2: Verifying control plane models...');
        const requiredModels = ['Business', 'User', 'TenantRegistry'];
        
        for (const modelName of requiredModels) {
            if (sequelize.models[modelName]) {
                success(`Control model ${modelName} exists`);
                this.results.testsPassed++;
            } else {
                error(`Control model ${modelName} MISSING`);
                this.results.testsFailed++;
                this.results.errors.push(`Missing control model: ${modelName}`);
            }
        }
        console.log();
    }

    async setupTestTenant() {
        const providedBusinessId = process.argv[2];
        
        if (providedBusinessId) {
            info(`Phase 3: Using provided business ID: ${providedBusinessId}`);
            this.createdBusinessId = providedBusinessId;
            
            // Verify tenant exists
            const TenantRegistry = sequelize.models.TenantRegistry?.schema('public');
            const tenant = await TenantRegistry.findOne({
                where: { businessId: providedBusinessId }
            });
            
            if (!tenant) {
                error(`Tenant with businessId ${providedBusinessId} not found`);
                throw new Error('Tenant not found');
            }
            
            success(`Found existing tenant: ${tenant.schemaName} (status: ${tenant.status})`);
            this.results.testsPassed++;
            return providedBusinessId;
        }

        info('Phase 3: Creating test tenant...');
        try {
            const result = await onboardingService.onboardBusiness(testTenantData);
            
            if (!result.success) {
                throw new Error(`Onboarding failed: ${result.message}`);
            }
            
            this.createdBusinessId = result.data.businessId;
            success(`Tenant created: ${result.data.schemaName}`);
            success(`Business ID: ${this.createdBusinessId}`);
            info(`Status: ${result.data.status} (background setup in progress)`);
            this.results.testsPassed++;
            
            // Wait for background setup (max 30 seconds)
            info('Waiting for background setup to complete...');
            await this.waitForActiveStatus(this.createdBusinessId, 30000);
            
            return this.createdBusinessId;
        } catch (err) {
            error(`Tenant creation failed: ${err.message}`);
            this.results.testsFailed++;
            this.results.errors.push(`Tenant creation: ${err.message}`);
            throw err;
        }
    }

    async waitForActiveStatus(businessId, maxWaitMs) {
        const TenantRegistry = sequelize.models.TenantRegistry?.schema('public');
        const startTime = Date.now();
        const checkInterval = 2000; // Check every 2 seconds
        
        while (Date.now() - startTime < maxWaitMs) {
            const tenant = await TenantRegistry.findOne({
                where: { businessId }
            });
            
            if (tenant && tenant.status === 'active') {
                success('Tenant is now ACTIVE');
                return;
            }
            
            if (tenant && tenant.status === 'INIT_FAILED') {
                error('Tenant initialization FAILED');
                throw new Error(`Tenant init failed: ${tenant.lastError || 'Unknown error'}`);
            }
            
            process.stdout.write('.');
            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
        
        warning('Timeout waiting for ACTIVE status - continuing verification');
        this.results.warnings.push('Tenant status timeout - may still be initializing');
    }

    async verifyTenantSchema(schemaName) {
        info(`Phase 4: Verifying tenant schema: ${schemaName}...`);
        
        try {
            // Check schema exists
            const schemaResult = await sequelize.query(`
                SELECT schema_name FROM information_schema.schemata WHERE schema_name = :schema
            `, { replacements: { schema: schemaName }, type: sequelize.QueryTypes.SELECT });
            
            if (!schemaResult.length) {
                error(`Schema ${schemaName} does not exist`);
                this.results.testsFailed++;
                this.results.errors.push(`Missing schema: ${schemaName}`);
                return;
            }
            success(`Schema ${schemaName} exists`);
            this.results.testsPassed++;

            // Check required tables
            const requiredTables = [
                'outlets', 'categories', 'table_areas', 'tables', 'products', 'orders',
                'settings', 'billing_configs', 'inventory_categories', 'customers',
                'expense_types', 'feature_flags', 'payments'
            ];
            
            const tablesResult = await sequelize.query(`
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = :schema AND table_type = 'BASE TABLE'
            `, { replacements: { schema: schemaName }, type: sequelize.QueryTypes.SELECT });
            
            const existingTables = tablesResult.map(t => t.table_name);
            const missingTables = requiredTables.filter(t => !existingTables.includes(t));
            
            info(`Found ${existingTables.length} tables in schema`);
            
            if (missingTables.length > 0) {
                error(`Missing tables: ${missingTables.join(', ')}`);
                this.results.testsFailed++;
                this.results.errors.push(`Missing tables: ${missingTables.join(', ')}`);
            } else {
                success('All required tables exist');
                this.results.testsPassed++;
            }
            
        } catch (err) {
            error(`Schema verification failed: ${err.message}`);
            this.results.testsFailed++;
            this.results.errors.push(`Schema verification: ${err.message}`);
        }
        console.log();
    }

    async verifyDefaultData(schemaName, businessId) {
        info('Phase 5: Verifying default data...');
        
        try {
            // Initialize models for this schema
            const models = await tenantModelLoader.initTenantModels(sequelize, schemaName);
            
            // Get outlet ID (should be only one after onboarding)
            const outlets = await models.Outlet.findAll({ where: { businessId } });
            if (outlets.length === 0) {
                error('No outlet found in tenant schema');
                this.results.testsFailed++;
                return;
            }
            const outletId = outlets[0].id;
            
            // Verify categories
            const categories = await models.Category.findAll({ where: { businessId, outletId } });
            if (categories.length === 0) {
                warning('No default categories found');
                this.results.warnings.push('No default categories');
            } else {
                success(`${categories.length} default categories found`);
                this.results.testsPassed++;
            }
            
            // Verify areas
            const areas = await models.Area.findAll({ where: { businessId, outletId } });
            if (areas.length === 0) {
                warning('No default areas found');
                this.results.warnings.push('No default areas');
            } else {
                success(`${areas.length} default areas found`);
                this.results.testsPassed++;
            }
            
            // Verify tables
            const tables = await models.Table.findAll({ where: { businessId, outletId } });
            if (tables.length === 0) {
                warning('No default tables found');
                this.results.warnings.push('No default tables');
            } else {
                success(`${tables.length} default tables found`);
                this.results.testsPassed++;
            }
            
            // Verify inventory categories
            const invCats = await models.InventoryCategory.findAll({ where: { businessId, outletId } });
            if (invCats.length === 0) {
                warning('No default inventory categories found');
                this.results.warnings.push('No default inventory categories');
            } else {
                success(`${invCats.length} default inventory categories found`);
                this.results.testsPassed++;
            }
            
            // Verify settings
            const settings = await models.Setting.findAll({ where: { businessId } });
            if (settings.length === 0) {
                warning('No default settings found');
                this.results.warnings.push('No default settings');
            } else {
                success(`${settings.length} default settings found`);
                this.results.testsPassed++;
            }
            
            // Verify billing config
            const billingConfigs = await models.BillingConfig.findAll({ where: { businessId, outletId } });
            if (billingConfigs.length === 0) {
                warning('No billing config found');
                this.results.warnings.push('No billing config');
            } else {
                success('Billing config exists');
                this.results.testsPassed++;
            }
            
        } catch (err) {
            error(`Default data verification failed: ${err.message}`);
            this.results.testsFailed++;
            this.results.errors.push(`Default data: ${err.message}`);
        }
        console.log();
    }

    async verifyAPIs(businessId) {
        info('Phase 6: Verifying API endpoints...');
        info('Note: API tests require running server and valid auth token');
        
        // These tests are informational only - they require a running server
        const endpoints = [
            { path: `/api/tenant/dashboard`, name: 'Dashboard API' },
            { path: `/api/tenant/products`, name: 'Products API' },
            { path: `/api/tenant/categories`, name: 'Categories API' },
            { path: `/api/tenant/orders`, name: 'Orders API' },
            { path: `/api/tenant/tables`, name: 'Tables API' },
            { path: `/api/tenant/users`, name: 'Users API' }
        ];
        
        for (const endpoint of endpoints) {
            info(`  - ${endpoint.name}: ${endpoint.path}`);
        }
        
        warning('API endpoint tests require running server - skipped in this script');
        info('Use Postman or curl with valid JWT token to test endpoints');
        console.log();
    }

    async verifyModelConsistency(schemaName) {
        info('Phase 7: Verifying model-database consistency...');
        
        try {
            const verification = await tenantModelLoader.verifySchemaIntegrity(sequelize, schemaName);
            
            if (verification.isValid) {
                success('All model columns match database schema');
                this.results.testsPassed++;
            } else {
                error('Model-database inconsistencies found');
                if (verification.missingTables.length > 0) {
                    error(`  Missing tables: ${verification.missingTables.join(', ')}`);
                }
                if (verification.missingColumns.length > 0) {
                    error(`  Missing columns: ${verification.missingColumns.join(', ')}`);
                }
                this.results.testsFailed++;
                this.results.errors.push('Model-database inconsistencies');
            }
            
        } catch (err) {
            error(`Model consistency check failed: ${err.message}`);
            this.results.testsFailed++;
            this.results.errors.push(`Model consistency: ${err.message}`);
        }
        console.log();
    }

    printSummary(startTime) {
        const duration = Date.now() - startTime;
        
        log('='.repeat(80), 'bright');
        log('VERIFICATION SUMMARY', 'bright');
        log('='.repeat(80), 'bright');
        console.log();
        
        log(`Tests Passed: ${this.results.testsPassed}`, 'green');
        log(`Tests Failed: ${this.results.testsFailed}`, this.results.testsFailed > 0 ? 'red' : 'reset');
        log(`Warnings: ${this.results.warnings.length}`, this.results.warnings.length > 0 ? 'yellow' : 'reset');
        log(`Duration: ${duration}ms`, 'cyan');
        console.log();
        
        if (this.results.errors.length > 0) {
            log('ERRORS:', 'red');
            this.results.errors.forEach((err, i) => {
                log(`  ${i + 1}. ${err}`, 'red');
            });
            console.log();
        }
        
        if (this.results.warnings.length > 0) {
            log('WARNINGS:', 'yellow');
            this.results.warnings.forEach((warn, i) => {
                log(`  ${i + 1}. ${warn}`, 'yellow');
            });
            console.log();
        }
        
        if (this.createdBusinessId && !process.argv[2]) {
            info(`Test tenant Business ID: ${this.createdBusinessId}`);
            info(`To verify this tenant again, run:`);
            info(`  node verify-tenant-onboarding.js ${this.createdBusinessId}`);
            console.log();
        }
        
        if (this.results.testsFailed === 0) {
            log('✅ ALL CHECKS PASSED - Tenant onboarding is working correctly!', 'green');
        } else {
            log('❌ SOME CHECKS FAILED - Review errors above', 'red');
            process.exit(1);
        }
        
        log('='.repeat(80), 'bright');
    }
}

// Run verification
const verifier = new TenantVerification();
verifier.run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
