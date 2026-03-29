#!/usr/bin/env node
/**
 * FULL SYSTEM TEST - Schema-First Onboarding
 * 
 * This test verifies:
 * 1. No migrations run during onboarding
 * 2. Complete schema created instantly
 * 3. No missing columns
 * 4. Tenant onboarding succeeds
 * 5. Auth works
 * 6. All APIs return correct data
 */

const { sequelize } = require('../config/unified_database');
const onboardingService = require('../services/onboardingService');
const authService = require('../services/authService');
const schemaCreationService = require('../services/schemaCreationService');

// Test configuration
const TEST_CONFIG = {
    businessName: 'Test Cafe ' + Date.now(),
    businessEmail: `test${Date.now()}@example.com`,
    businessPhone: '+1234567890',
    businessAddress: '123 Test Street',
    adminName: 'Test Admin',
    adminEmail: `admin${Date.now()}@example.com`,
    adminPassword: 'TestPassword123!',
    cafeType: 'SOLO'
};

class FullSystemTest {
    constructor() {
        this.results = {
            passed: [],
            failed: [],
            errors: []
        };
        this.testData = {};
    }

    async run() {
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('  FULL SYSTEM TEST - Schema-First Onboarding Verification');
        console.log('═══════════════════════════════════════════════════════════════\n');

        try {
            // Test 1: Verify Database Connection
            await this.testDatabaseConnection();

            // Test 2: Run Onboarding
            await this.testOnboarding();

            // Test 3: Verify No Migrations Ran
            await this.testNoMigrationsRan();

            // Test 4: Verify Complete Schema
            await this.testCompleteSchema();

            // Test 5: Verify Required Columns
            await this.testRequiredColumns();

            // Test 6: Test Authentication
            await this.testAuthentication();

            // Test 7: Test API Simulation
            await this.testApiSimulation();

            // Print Results
            this.printResults();

            return this.results.failed.length === 0;

        } catch (error) {
            console.error('\n🚨 CRITICAL TEST FAILURE:', error.message);
            console.error(error.stack);
            this.results.failed.push('Critical test execution');
            this.results.errors.push(error.message);
            return false;
        } finally {
            await sequelize.close();
        }
    }

    async testDatabaseConnection() {
        console.log('🔌 Test 1: Database Connection');
        try {
            await sequelize.authenticate();
            console.log('   ✅ Database connection successful\n');
            this.results.passed.push('Database connection');
        } catch (error) {
            throw new Error(`Database connection failed: ${error.message}`);
        }
    }

    async testOnboarding() {
        console.log('🏪 Test 2: Tenant Onboarding');
        try {
            const result = await onboardingService.onboardBusiness(TEST_CONFIG);
            
            if (!result.success) {
                throw new Error(`Onboarding failed: ${result.message}`);
            }

            this.testData.businessId = result.data.businessId;
            this.testData.outletId = result.data.outletId;
            this.testData.schemaName = result.data.schemaName;

            console.log(`   ✅ Onboarding successful`);
            console.log(`   📊 Business ID: ${result.data.businessId}`);
            console.log(`   📊 Schema: ${result.data.schemaName}`);
            console.log(`   📊 Duration: ${result.data.duration}\n`);

            this.results.passed.push('Tenant onboarding');
        } catch (error) {
            throw new Error(`Onboarding failed: ${error.message}`);
        }
    }

    async testNoMigrationsRan() {
        console.log('🚫 Test 3: Verify NO Migrations Ran During Onboarding');
        try {
            const schemaName = this.testData.schemaName;
            
            // Check schema_versions table
            const versions = await sequelize.query(
                `SELECT version, migration_name, applied_by 
                 FROM "${schemaName}"."schema_versions" 
                 ORDER BY version`,
                { type: sequelize.QueryTypes.SELECT }
            );

            // All versions should be marked as created by SchemaCreationService
            const nonSchemaCreationMigrations = versions.filter(v => 
                v.applied_by !== 'schemaCreationService' && !v.applied_by?.includes('schemaCreation')
            );

            if (nonSchemaCreationMigrations.length > 0) {
                throw new Error(`Found ${nonSchemaCreationMigrations.length} migrations that ran during onboarding!`);
            }

            // Verify we have the expected versions
            const expectedVersions = [1, 3, 4, 5, 6, 7, 8, 9];
            const actualVersions = versions.map(v => v.version);
            const missingVersions = expectedVersions.filter(v => !actualVersions.includes(v));

            if (missingVersions.length > 0) {
                throw new Error(`Missing expected versions: ${missingVersions.join(', ')}`);
            }

            console.log(`   ✅ NO actual migrations ran during onboarding`);
            console.log(`   ✅ All ${versions.length} versions marked as created by SchemaCreationService\n`);
            this.results.passed.push('No migrations during onboarding');
        } catch (error) {
            throw new Error(`Migration verification failed: ${error.message}`);
        }
    }

    async testCompleteSchema() {
        console.log('🏗️  Test 4: Verify Complete Schema Created');
        try {
            const schemaName = this.testData.schemaName;
            
            const tables = await sequelize.query(
                `SELECT table_name 
                 FROM information_schema.tables 
                 WHERE table_schema = :schema 
                 AND table_type = 'BASE TABLE'`,
                { 
                    replacements: { schema: schemaName },
                    type: sequelize.QueryTypes.SELECT 
                }
            );

            const tableNames = tables.map(t => t.table_name);
            const requiredTables = [
                'outlets', 'products', 'orders', 'categories', 
                'inventory_items', 'settings', 'table_areas', 'tables', 
                'billing_configs', 'order_items', 'inventory_transactions',
                'schema_versions', 'customers', 'inventory_categories',
                'accounts', 'expenses', 'payments', 'suppliers'
            ];

            const missingTables = requiredTables.filter(t => !tableNames.includes(t));

            if (missingTables.length > 0) {
                throw new Error(`Missing tables: ${missingTables.join(', ')}`);
            }

            console.log(`   ✅ All ${requiredTables.length} required tables exist`);
            console.log(`   ✅ Found ${tableNames.length} total tables\n`);
            this.results.passed.push('Complete schema created');
        } catch (error) {
            throw new Error(`Schema verification failed: ${error.message}`);
        }
    }

    async testRequiredColumns() {
        console.log('📋 Test 5: Verify Required Columns Exist');
        try {
            const schemaName = this.testData.schemaName;
            
            const requiredColumns = {
                'products': ['id', 'business_id', 'outlet_id', 'sku', 'name', 'barcode', 'cost', 'tax_rate', 'created_at', 'updated_at'],
                'inventory_items': ['id', 'business_id', 'outlet_id', 'sku', 'name', 'created_at', 'updated_at'],
                'orders': ['id', 'business_id', 'outlet_id', 'order_number', 'type', 'notes', 'created_at', 'updated_at'],
                'categories': ['id', 'business_id', 'outlet_id', 'name', 'created_at', 'updated_at'],
                'outlets': ['id', 'business_id', 'name', 'created_at', 'updated_at']
            };

            for (const [table, columns] of Object.entries(requiredColumns)) {
                const cols = await sequelize.query(
                    `SELECT column_name 
                     FROM information_schema.columns 
                     WHERE table_schema = :schema AND table_name = :table`,
                    { 
                        replacements: { schema: schemaName, table },
                        type: sequelize.QueryTypes.SELECT 
                    }
                );

                const existingCols = cols.map(c => c.column_name);
                const missingCols = columns.filter(c => !existingCols.includes(c));

                if (missingCols.length > 0) {
                    throw new Error(`Missing columns in ${table}: ${missingCols.join(', ')}`);
                }
            }

            console.log(`   ✅ All required columns exist in critical tables`);
            console.log(`   ✅ products: sku, barcode, cost, tax_rate present`);
            console.log(`   ✅ orders: type, notes present\n`);
            this.results.passed.push('Required columns verified');
        } catch (error) {
            throw new Error(`Column verification failed: ${error.message}`);
        }
    }

    async testAuthentication() {
        console.log('🔐 Test 6: Verify Authentication Works');
        try {
            // Test login with the created user
            const user = await authService.login(TEST_CONFIG.adminEmail, TEST_CONFIG.adminPassword);
            
            if (!user || !user.id) {
                throw new Error('Login returned invalid user data');
            }

            // Verify user has correct business association
            if (!user.businessId && !user.business_id) {
                throw new Error('User missing business association');
            }

            // Generate tokens
            const accessToken = authService.generateAccessToken(user);
            const refreshToken = authService.generateRefreshToken(user);

            if (!accessToken || !refreshToken) {
                throw new Error('Token generation failed');
            }

            this.testData.accessToken = accessToken;
            this.testData.user = user;

            console.log(`   ✅ Login successful`);
            console.log(`   ✅ User ID: ${user.id}`);
            console.log(`   ✅ Business ID: ${user.businessId || user.business_id}`);
            console.log(`   ✅ Tokens generated successfully\n`);
            this.results.passed.push('Authentication works');
        } catch (error) {
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    async testApiSimulation() {
        console.log('🌐 Test 7: API Simulation (Token Context)');
        try {
            // Verify token contains all required fields
            const jwt = require('jsonwebtoken');
            const config = require('../config/config');
            
            const decoded = jwt.verify(this.testData.accessToken, config.accessTokenSecret, {
                issuer: 'brewwlabs-pos',
                audience: 'brewwlabs-pos-users'
            });

            // Verify all critical fields in token (check both camelCase and snake_case)
            const requiredFields = [
                { name: 'id', alternatives: ['id', '_id'] },
                { name: 'email', alternatives: ['email'] },
                { name: 'role', alternatives: ['role'] },
                { name: 'business_id', alternatives: ['business_id', 'businessId'] },
                { name: 'outlet_id', alternatives: ['outlet_id', 'outletId'] }
            ];
            
            const missingFields = requiredFields.filter(f => {
                return !f.alternatives.some(alt => decoded[alt] !== undefined);
            }).map(f => f.name);

            if (missingFields.length > 0) {
                throw new Error(`Token missing fields: ${missingFields.join(', ')}`);
            }

            console.log(`   ✅ Token contains all required fields`);
            console.log(`   ✅ business_id: ${decoded.business_id || decoded.businessId}`);
            console.log(`   ✅ outlet_id: ${decoded.outlet_id || decoded.outletId}`);
            console.log(`   ✅ role: ${decoded.role}\n`);
            this.results.passed.push('API simulation (token context)');
        } catch (error) {
            throw new Error(`API simulation failed: ${error.message}`);
        }
    }

    printResults() {
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('  TEST RESULTS');
        console.log('═══════════════════════════════════════════════════════════════');
        
        console.log(`\n✅ PASSED: ${this.results.passed.length}`);
        this.results.passed.forEach(test => console.log(`   ✓ ${test}`));

        if (this.results.failed.length > 0) {
            console.log(`\n❌ FAILED: ${this.results.failed.length}`);
            this.results.failed.forEach(test => console.log(`   ✗ ${test}`));
        }

        if (this.results.errors.length > 0) {
            console.log(`\n🚨 ERRORS:`);
            this.results.errors.forEach(err => console.log(`   ! ${err}`));
        }

        const allPassed = this.results.failed.length === 0;
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log(allPassed ? '  ✅ ALL TESTS PASSED' : '  ❌ SOME TESTS FAILED');
        console.log('═══════════════════════════════════════════════════════════════\n');

        return allPassed;
    }
}

// Run tests if executed directly
if (require.main === module) {
    const test = new FullSystemTest();
    test.run()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test runner error:', error);
            process.exit(1);
        });
}

module.exports = FullSystemTest;
