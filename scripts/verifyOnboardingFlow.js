#!/usr/bin/env node
/**
 * Onboarding Flow Verification Script
 * 
 * Verifies:
 * - Control plane consistency (businesses, users, tenant_registry)
 * - Tenant schema creation
 * - Base tables (schema_versions, outlets, settings)
 * - Initial data insertion
 * - Migration system readiness
 */

const { sequelize } = require('../config/unified_database');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const onboardingService = require('../services/onboardingService');

const TEST_EMAIL = `test-${Date.now()}@verification.local`;
const TEST_BUSINESS_EMAIL = `business-${Date.now()}@verification.local`;

class OnboardingVerifier {
    constructor() {
        this.results = {
            controlPlane: {},
            tenantSchema: {},
            tables: {},
            data: {},
            errors: []
        };
        this.testBusinessId = null;
        this.testSchemaName = null;
    }

    async run() {
        console.log('🔍 ==========================================');
        console.log('🔍 ONBOARDING FLOW VERIFICATION');
        console.log('🔍 ==========================================\n');

        try {
            // Test 1: Verify Control Plane Tables
            await this.verifyControlPlaneTables();

            // Test 2: Run Onboarding
            await this.testOnboarding();

            // Test 3: Verify Control Plane Data
            await this.verifyControlPlaneData();

            // Test 4: Verify Tenant Schema
            await this.verifyTenantSchema();

            // Test 5: Verify Base Tables
            await this.verifyBaseTables();

            // Test 6: Verify Initial Data
            await this.verifyInitialData();

            // Test 7: Verify Migration System
            await this.verifyMigrationSystem();

            // Print Report
            this.printReport();

        } catch (error) {
            console.error('\n🚨 VERIFICATION FAILED:', error.message);
            console.error(error.stack);
            this.results.errors.push(error.message);
            this.printReport();
            process.exit(1);
        } finally {
            await this.cleanup();
            await sequelize.close();
        }
    }

    async verifyControlPlaneTables() {
        console.log('📋 STEP 1: Verifying Control Plane Tables...');

        const requiredTables = ['businesses', 'users', 'tenant_registry'];
        const results = {};

        for (const table of requiredTables) {
            const [result] = await sequelize.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = '${table}'
                );
            `, { type: sequelize.QueryTypes.SELECT });
            
            results[table] = result.exists;
            console.log(`   ${result.exists ? '✅' : '❌'} ${table}`);
        }

        this.results.controlPlane.tablesExist = results;
        
        // Verify tenant_registry columns
        const columnsResult = await sequelize.query(`
            SELECT column_name, is_nullable, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = 'tenant_registry'
            ORDER BY ordinal_position;
        `, { type: sequelize.QueryTypes.SELECT });

        const columns = Array.isArray(columnsResult) ? columnsResult : [];
        const businessIdColumn = columns.find(c => c.column_name === 'business_id');
        if (businessIdColumn) {
            console.log(`   ✅ business_id column: ${businessIdColumn.data_type}, nullable: ${businessIdColumn.is_nullable}`);
            if (businessIdColumn.is_nullable === 'YES') {
                console.log('   ⚠️  WARNING: business_id allows NULL - should be NOT NULL');
            }
        } else {
            console.log('   ❌ business_id column not found!');
            this.results.errors.push('tenant_registry missing business_id column');
        }

        this.results.controlPlane.columns = columns;
    }

    async testOnboarding() {
        console.log('\n🏢 STEP 2: Running Test Onboarding...');

        const testData = {
            businessName: 'Verification Test Business',
            businessEmail: TEST_BUSINESS_EMAIL,
            businessPhone: '+1234567890',
            businessAddress: 'Test Address',
            gstNumber: 'GST123456',
            adminName: 'Test Admin',
            adminEmail: TEST_EMAIL,
            adminPassword: 'TestPass123!',
            cafeType: 'SOLO'
        };

        const startTime = Date.now();
        const result = await onboardingService.onboardBusiness(testData);
        const duration = Date.now() - startTime;

        if (!result.success) {
            throw new Error(`Onboarding failed: ${result.message}`);
        }

        this.testBusinessId = result.data.businessId;
        this.testSchemaName = result.data.schemaName;

        console.log(`   ✅ Onboarding completed in ${duration}ms`);
        console.log(`   📊 Business ID: ${this.testBusinessId}`);
        console.log(`   📊 Schema Name: ${this.testSchemaName}`);
        console.log(`   📊 Status: ${result.data.status}`);

        this.results.onboarding = {
            success: true,
            duration,
            businessId: this.testBusinessId,
            schemaName: this.testSchemaName,
            status: result.data.status
        };

        // Wait a moment for background processes
        console.log('   ⏳ Waiting 2s for background processes...');
        await new Promise(r => setTimeout(r, 2000));
    }

    async verifyControlPlaneData() {
        console.log('\n📊 STEP 3: Verifying Control Plane Data...');

        // Check Business
        const [business] = await sequelize.query(`
            SELECT id, name, email, status, owner_id
            FROM public.businesses
            WHERE email = '${TEST_BUSINESS_EMAIL}'
            LIMIT 1;
        `, { type: sequelize.QueryTypes.SELECT });

        if (business) {
            console.log(`   ✅ Business created: ${business.id}`);
            console.log(`      Name: ${business.name}`);
            console.log(`      Status: ${business.status}`);
            this.results.controlPlane.business = business;
        } else {
            console.log('   ❌ Business not found!');
            this.results.errors.push('Business not found in control plane');
        }

        // Check User
        const [user] = await sequelize.query(`
            SELECT id, email, business_id, role, panel_type
            FROM public.users
            WHERE email = '${TEST_EMAIL}'
            LIMIT 1;
        `, { type: sequelize.QueryTypes.SELECT });

        if (user) {
            console.log(`   ✅ User created: ${user.id}`);
            console.log(`      Email: ${user.email}`);
            console.log(`      Role: ${user.role}`);
            console.log(`      businessId: ${user.businessId}`);
            this.results.controlPlane.user = user;
        } else {
            console.log('   ❌ User not found!');
            this.results.errors.push('User not found in control plane');
        }

        // Check Tenant Registry
        const [registry] = await sequelize.query(`
            SELECT id, business_id, schema_name, status, created_at
            FROM public.tenant_registry
            WHERE business_id = '${this.testBusinessId}'
            LIMIT 1;
        `, { type: sequelize.QueryTypes.SELECT });

        if (registry) {
            console.log(`   ✅ Tenant Registry created:`);
            console.log(`      ID: ${registry.id}`);
            console.log(`      business_id: ${registry.business_id}`);
            console.log(`      schema_name: ${registry.schema_name}`);
            console.log(`      status: ${registry.status}`);
            console.log(`      created_at: ${registry.created_at}`);
            
            if (registry.business_id !== this.testBusinessId) {
                console.log('   ❌ ERROR: business_id mismatch!');
                this.results.errors.push('Tenant registry business_id mismatch');
            }
            
            this.results.controlPlane.registry = registry;
        } else {
            console.log('   ❌ Tenant Registry not found!');
            this.results.errors.push('Tenant registry not found in control plane');
        }
    }

    async verifyTenantSchema() {
        console.log('\n🏗️  STEP 4: Verifying Tenant Schema...');

        const [schema] = await sequelize.query(`
            SELECT schema_name
            FROM information_schema.schemata
            WHERE schema_name = '${this.testSchemaName}'
            LIMIT 1;
        `, { type: sequelize.QueryTypes.SELECT });

        if (schema) {
            console.log(`   ✅ Schema exists: ${schema.schema_name}`);
            this.results.tenantSchema.exists = true;
            this.results.tenantSchema.name = schema.schema_name;
        } else {
            console.log(`   ❌ Schema not found: ${this.testSchemaName}`);
            this.results.tenantSchema.exists = false;
            this.results.errors.push('Tenant schema not created');
        }
    }

    async verifyBaseTables() {
        console.log('\n📦 STEP 5: Verifying Base Tenant Tables...');

        const requiredTables = ['schema_versions', 'outlets', 'settings'];
        const results = {};

        for (const table of requiredTables) {
            const [result] = await sequelize.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = '${this.testSchemaName}' 
                    AND table_name = '${table}'
                );
            `, { type: sequelize.QueryTypes.SELECT });
            
            results[table] = result.exists;
            console.log(`   ${result.exists ? '✅' : '❌'} ${table}`);
        }

        this.results.tables = results;

        // Check for any missing tables
        const missingTables = Object.entries(results)
            .filter(([_, exists]) => !exists)
            .map(([name]) => name);

        if (missingTables.length > 0) {
            this.results.errors.push(`Missing tenant tables: ${missingTables.join(', ')}`);
        }
    }

    async verifyInitialData() {
        console.log('\n🌱 STEP 6: Verifying Initial Data...');

        // Check schema_versions
        const [version] = await sequelize.query(`
            SELECT version, migration_name, description, applied_by
            FROM "${this.testSchemaName}".schema_versions
            WHERE version = 0
            LIMIT 1;
        `, { type: sequelize.QueryTypes.SELECT });

        if (version) {
            console.log(`   ✅ schema_versions baseline:`);
            console.log(`      version: ${version.version}`);
            console.log(`      migration: ${version.migration_name}`);
            this.results.data.schemaVersion = version;
        } else {
            console.log('   ❌ schema_versions baseline not found!');
            this.results.errors.push('Missing schema_versions baseline');
        }

        // Check default outlet
        const [outlet] = await sequelize.query(`
            SELECT id, name, business_id, status
            FROM "${this.testSchemaName}".outlets
            LIMIT 1;
        `, { type: sequelize.QueryTypes.SELECT });

        if (outlet) {
            console.log(`   ✅ Default outlet created:`);
            console.log(`      id: ${outlet.id}`);
            console.log(`      name: ${outlet.name}`);
            console.log(`      business_id: ${outlet.business_id}`);
            console.log(`      status: ${outlet.status}`);
            
            if (outlet.business_id !== this.testBusinessId) {
                console.log('   ❌ ERROR: Outlet business_id mismatch!');
                this.results.errors.push('Outlet business_id mismatch');
            }
            
            this.results.data.defaultOutlet = outlet;
        } else {
            console.log('   ❌ Default outlet not found!');
            this.results.errors.push('Missing default outlet');
        }
    }

    async verifyMigrationSystem() {
        console.log('\n🔄 STEP 7: Verifying Migration System...');

        // Check if migration runner is available
        try {
            const migrationRunner = require('../src/architecture/migrationRunner');
            console.log('   ✅ Migration runner module available');
            this.results.migrationSystem = { runnerAvailable: true };
        } catch (error) {
            console.log('   ❌ Migration runner not available:', error.message);
            this.results.migrationSystem = { runnerAvailable: false };
            this.results.errors.push('Migration runner not available');
        }

        // Check tenant model loader
        try {
            const tenantModelLoader = require('../src/architecture/tenantModelLoader');
            console.log('   ✅ Tenant model loader available');
            this.results.migrationSystem.modelLoaderAvailable = true;
        } catch (error) {
            console.log('   ❌ Tenant model loader not available:', error.message);
            this.results.migrationSystem.modelLoaderAvailable = false;
            this.results.errors.push('Tenant model loader not available');
        }
    }

    async cleanup() {
        if (!this.testBusinessId) return;

        console.log('\n🧹 Cleaning up test data...');

        try {
            // Drop test schema
            await sequelize.query(`DROP SCHEMA IF EXISTS "${this.testSchemaName}" CASCADE;`);
            console.log(`   ✅ Dropped schema: ${this.testSchemaName}`);

            // Clean up control plane data
            await sequelize.query(`DELETE FROM public.tenant_registry WHERE business_id = '${this.testBusinessId}';`);
            await sequelize.query(`DELETE FROM public.users WHERE email = '${TEST_EMAIL}';`);
            await sequelize.query(`DELETE FROM public.businesses WHERE email = '${TEST_BUSINESS_EMAIL}';`);
            console.log('   ✅ Cleaned up control plane data');

        } catch (error) {
            console.error('   ⚠️  Cleanup error:', error.message);
        }
    }

    printReport() {
        console.log('\n');
        console.log('📊 ==========================================');
        console.log('📊 VERIFICATION REPORT');
        console.log('📊 ==========================================');

        // Control Plane Status
        console.log('\n🏛️  CONTROL PLANE STATUS:');
        const allTablesExist = Object.values(this.results.controlPlane.tablesExist || {}).every(v => v);
        console.log(`   ${allTablesExist ? '✅ VALID' : '❌ INVALID'} - Tables`);

        if (this.results.controlPlane.registry) {
            const reg = this.results.controlPlane.registry;
            console.log(`   ${reg.business_id ? '✅' : '❌'} business_id present`);
            console.log(`   ${reg.schema_name ? '✅' : '❌'} schema_name present`);
            console.log(`   ${reg.status === 'CREATING' || reg.status === 'READY' ? '✅' : '❌'} status valid (${reg.status})`);
        }

        // Tenant Schema Status
        console.log('\n🏢 TENANT SCHEMA STATUS:');
        if (this.results.tenantSchema.exists) {
            console.log(`   ✅ Schema exists: ${this.results.tenantSchema.name}`);
        } else {
            console.log('   ❌ Schema missing');
        }

        // Tables Status
        console.log('\n📦 BASE TABLES STATUS:');
        const allTenantTablesExist = Object.values(this.results.tables || {}).every(v => v);
        console.log(`   ${allTenantTablesExist ? '✅ VALID' : '❌ INVALID'}`);
        Object.entries(this.results.tables || {}).forEach(([table, exists]) => {
            console.log(`     ${exists ? '✅' : '❌'} ${table}`);
        });

        // Data Status
        console.log('\n🌱 INITIAL DATA STATUS:');
        if (this.results.data.schemaVersion) {
            console.log(`   ✅ schema_versions: v${this.results.data.schemaVersion.version}`);
        } else {
            console.log('   ❌ schema_versions missing');
        }
        if (this.results.data.defaultOutlet) {
            console.log(`   ✅ Default outlet: ${this.results.data.defaultOutlet.name}`);
        } else {
            console.log('   ❌ Default outlet missing');
        }

        // Migration System
        console.log('\n🔄 MIGRATION SYSTEM:');
        if (this.results.migrationSystem?.runnerAvailable) {
            console.log('   ✅ Migration runner available');
        } else {
            console.log('   ❌ Migration runner not available');
        }

        // Onboarding Time
        if (this.results.onboarding?.duration) {
            console.log('\n⚡ ONBOARDING TIME:');
            console.log(`   ${this.results.onboarding.duration}ms`);
        }

        // Errors
        if (this.results.errors.length > 0) {
            console.log('\n❌ ERRORS FOUND:');
            this.results.errors.forEach((err, i) => {
                console.log(`   ${i + 1}. ${err}`);
            });
        }

        // Final Status
        console.log('\n📊 ==========================================');
        const isFullyStable = 
            allTablesExist && 
            this.results.tenantSchema.exists && 
            allTenantTablesExist && 
            this.results.errors.length === 0 &&
            this.results.migrationSystem?.runnerAvailable;

        if (isFullyStable) {
            console.log('✅ SYSTEM FULLY STABLE');
        } else {
            console.log('⚠️  SYSTEM NOT STABLE - Review errors above');
        }
        console.log('📊 ==========================================\n');

        return isFullyStable;
    }
}

// Run if called directly
if (require.main === module) {
    const verifier = new OnboardingVerifier();
    verifier.run().then(isStable => {
        process.exit(isStable ? 0 : 1);
    });
}

module.exports = OnboardingVerifier;
