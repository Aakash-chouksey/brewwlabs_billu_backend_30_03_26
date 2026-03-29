#!/usr/bin/env node
/**
 * DATABASE RESET & ONBOARDING DEBUG SCRIPT
 * 
 * This script:
 * 1. Drops all existing tenant schemas and resets public schema
 * 2. Creates a new tenant via onboarding
 * 3. Logs detailed schema creation process
 * 4. Shows exactly what data is stored in the database
 */

const { Sequelize } = require('sequelize');
const { controlPlaneSequelize } = require('../config/control_plane_db');
const { ModelFactory } = require('../src/architecture/modelFactory');

// Test configuration
const TEST_CONFIG = {
    businessName: `Debug Test Business ${Date.now()}`,
    businessEmail: `debug-biz-${Date.now()}@test.com`,
    adminEmail: `debug-admin-${Date.now()}@test.com`,
    adminPassword: 'TestPass123!',
    businessPhone: '9876543210',
    businessAddress: '123 Debug Street, Test City',
    gstNumber: 'GST12345678',
    adminName: 'Debug Admin',
    cafeType: 'SOLO'
};

/**
 * Step 1: Drop all schemas and reset database
 */
async function resetDatabase() {
    console.log('\n' + '='.repeat(80));
    console.log('🗑️  STEP 1: RESETTING DATABASE');
    console.log('='.repeat(80) + '\n');

    try {
        // Get all tenant schemas
        const schemas = await controlPlaneSequelize.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'tenant_%' 
            OR schema_name LIKE 'test_%'
            ORDER BY schema_name
        `, { type: Sequelize.QueryTypes.SELECT });

        console.log(`📊 Found ${schemas.length} tenant schemas to drop:`);
        schemas.forEach(s => console.log(`   - ${s.schema_name}`));

        // Drop each tenant schema
        for (const schema of schemas) {
            const schemaName = schema.schema_name;
            console.log(`\n   🗑️  Dropping schema: ${schemaName}`);
            try {
                await controlPlaneSequelize.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
                console.log(`   ✅ Dropped ${schemaName}`);
            } catch (err) {
                console.error(`   ❌ Error dropping ${schemaName}:`, err.message);
            }
        }

        // Clean up public schema tables (keep the schema itself)
        const publicTables = await controlPlaneSequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        `, { type: Sequelize.QueryTypes.SELECT });

        console.log(`\n📊 Found ${publicTables.length} tables in public schema`);

        // Truncate tables instead of dropping to keep schema structure
        for (const table of publicTables) {
            const tableName = table.table_name;
            try {
                await controlPlaneSequelize.query(`TRUNCATE TABLE "public"."${tableName}" CASCADE`);
                console.log(`   🧹 Truncated: ${tableName}`);
            } catch (err) {
                console.error(`   ❌ Error truncating ${tableName}:`, err.message);
            }
        }

        console.log('\n✅ Database reset complete');
        return true;
    } catch (error) {
        console.error('\n❌ Database reset failed:', error.message);
        throw error;
    }
}

/**
 * Step 2: Initialize models
 */
async function initializeModels() {
    console.log('\n' + '='.repeat(80));
    console.log('🏗️  STEP 2: INITIALIZING MODELS');
    console.log('='.repeat(80) + '\n');

    try {
        ModelFactory.setupModelDefinitions();
        const models = await ModelFactory.createModels(controlPlaneSequelize);
        
        console.log(`✅ Initialized ${Object.keys(models).length} models`);
        console.log('\n📋 Control Plane Models:');
        const controlModels = ['Business', 'User', 'TenantRegistry', 'Plan', 'Subscription'];
        controlModels.forEach(name => {
            if (models[name]) {
                const attrs = Object.keys(models[name].rawAttributes || {});
                console.log(`   ✅ ${name}: ${attrs.length} attributes`);
            } else {
                console.log(`   ❌ ${name}: NOT FOUND`);
            }
        });

        return models;
    } catch (error) {
        console.error('❌ Model initialization failed:', error.message);
        throw error;
    }
}

/**
 * Step 3: Run onboarding and log everything
 */
async function runOnboardingWithDebug() {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 STEP 3: RUNNING ONBOARDING WITH DEBUG LOGGING');
    console.log('='.repeat(80) + '\n');

    console.log('📋 Test Data:');
    console.log(`   Business Name: ${TEST_CONFIG.businessName}`);
    console.log(`   Business Email: ${TEST_CONFIG.businessEmail}`);
    console.log(`   Admin Email: ${TEST_CONFIG.adminEmail}`);
    console.log(`   Admin Password: ${TEST_CONFIG.adminPassword}`);
    console.log(`   Business Phone: ${TEST_CONFIG.businessPhone}`);
    console.log('');

    try {
        // Import onboarding service
        const onboardingService = require('../services/onboardingService');
        
        // Create a wrapper to intercept and log all database operations
        const originalQuery = controlPlaneSequelize.query.bind(controlPlaneSequelize);
        
        console.log('\n🔄 Starting onboarding process...\n');
        
        // Run onboarding
        const result = await onboardingService.onboardBusiness(TEST_CONFIG);
        
        console.log('\n✅ Onboarding completed');
        console.log('\n📊 Onboarding Result:');
        console.log(JSON.stringify(result, null, 2));
        
        return result;
    } catch (error) {
        console.error('\n❌ Onboarding failed:', error.message);
        console.error('Stack:', error.stack);
        throw error;
    }
}

/**
 * Step 4: Inspect what was created in the database
 */
async function inspectDatabase(businessId, schemaName) {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 STEP 4: INSPECTING DATABASE STATE');
    console.log('='.repeat(80) + '\n');

    // 4.1: Check public.tenant_registry
    console.log('📋 4.1: PUBLIC.TENANT_REGISTRY');
    console.log('-'.repeat(40));
    
    try {
        const registry = await controlPlaneSequelize.query(`
            SELECT * FROM public.tenant_registry 
            WHERE business_id = :businessId
        `, { 
            replacements: { businessId },
            type: Sequelize.QueryTypes.SELECT 
        });
        
        if (registry.length > 0) {
            console.log('✅ Registry entry found:');
            registry.forEach((row, i) => {
                console.log(`\n   Entry ${i + 1}:`);
                Object.entries(row).forEach(([key, value]) => {
                    console.log(`      ${key}: ${value}`);
                });
            });
        } else {
            console.log('❌ No registry entry found');
        }
    } catch (err) {
        console.error('❌ Error querying tenant_registry:', err.message);
    }

    // 4.2: Check public.businesses
    console.log('\n📋 4.2: PUBLIC.BUSINESSES');
    console.log('-'.repeat(40));
    
    try {
        const businesses = await controlPlaneSequelize.query(`
            SELECT id, name, email, phone, status, type, is_active, created_at
            FROM public.businesses 
            WHERE id = :businessId
        `, { 
            replacements: { businessId },
            type: Sequelize.QueryTypes.SELECT 
        });
        
        if (businesses.length > 0) {
            console.log('✅ Business record found:');
            businesses.forEach((row, i) => {
                console.log(`\n   Business ${i + 1}:`);
                Object.entries(row).forEach(([key, value]) => {
                    console.log(`      ${key}: ${value}`);
                });
            });
        } else {
            console.log('❌ No business record found');
        }
    } catch (err) {
        console.error('❌ Error querying businesses:', err.message);
    }

    // 4.3: Check public.users
    console.log('\n📋 4.3: PUBLIC.USERS');
    console.log('-'.repeat(40));
    
    try {
        const users = await controlPlaneSequelize.query(`
            SELECT id, name, email, role, business_id, is_active, created_at
            FROM public.users 
            WHERE business_id = :businessId
        `, { 
            replacements: { businessId },
            type: Sequelize.QueryTypes.SELECT 
        });
        
        if (users.length > 0) {
            console.log('✅ User records found:');
            users.forEach((row, i) => {
                console.log(`\n   User ${i + 1}:`);
                Object.entries(row).forEach(([key, value]) => {
                    console.log(`      ${key}: ${value}`);
                });
            });
        } else {
            console.log('❌ No user records found');
        }
    } catch (err) {
        console.error('❌ Error querying users:', err.message);
    }

    // 4.4: Check tenant schema
    console.log(`\n📋 4.4: TENANT SCHEMA: ${schemaName}`);
    console.log('-'.repeat(40));
    
    try {
        // Check if schema exists
        const schemaExists = await controlPlaneSequelize.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name = :schemaName
        `, { 
            replacements: { schemaName },
            type: Sequelize.QueryTypes.SELECT 
        });
        
        if (schemaExists.length > 0) {
            console.log(`✅ Schema ${schemaName} exists`);
            
            // List tables in the schema
            const tables = await controlPlaneSequelize.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = :schemaName
                ORDER BY table_name
            `, { 
                replacements: { schemaName },
                type: Sequelize.QueryTypes.SELECT 
            });
            
            console.log(`\n📊 Tables in ${schemaName} (${tables.length} tables):`);
            tables.forEach((row, i) => {
                console.log(`   ${i + 1}. ${row.table_name}`);
            });
            
            // Check sample data in key tables
            const keyTables = ['outlets', 'categories', 'products', 'users'];
            for (const table of keyTables) {
                try {
                    const count = await controlPlaneSequelize.query(`
                        SELECT COUNT(*) as count 
                        FROM "${schemaName}"."${table}"
                    `, { type: Sequelize.QueryTypes.SELECT });
                    
                    console.log(`\n   ${table}: ${count[0].count} rows`);
                    
                    // Show first row if exists
                    if (count[0].count > 0) {
                        const sample = await controlPlaneSequelize.query(`
                            SELECT * FROM "${schemaName}"."${table}" LIMIT 1
                        `, { type: Sequelize.QueryTypes.SELECT });
                        
                        console.log('   Sample data:');
                        Object.entries(sample[0]).forEach(([key, value]) => {
                            const valStr = value && typeof value === 'object' 
                                ? JSON.stringify(value).substring(0, 50) 
                                : String(value).substring(0, 50);
                            console.log(`      ${key}: ${valStr}`);
                        });
                    }
                } catch (err) {
                    console.log(`   ${table}: Error - ${err.message}`);
                }
            }
        } else {
            console.log(`❌ Schema ${schemaName} does not exist`);
        }
    } catch (err) {
        console.error(`❌ Error inspecting schema ${schemaName}:`, err.message);
    }
}

/**
 * Main execution
 */
async function main() {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 DATABASE RESET & ONBOARDING DEBUG');
    console.log('='.repeat(80));
    console.log('\n⚠️  This will DELETE all tenant data and create a new test tenant');
    console.log('⏳ Starting in 3 seconds...\n');
    
    await new Promise(r => setTimeout(r, 3000));

    let businessId = null;
    let schemaName = null;

    try {
        // Step 1: Reset database
        await resetDatabase();
        
        // Step 2: Initialize models
        await initializeModels();
        
        // Step 3: Run onboarding
        const result = await runOnboardingWithDebug();
        
        if (result.success) {
            businessId = result.data?.business?.id;
            schemaName = result.data?.tenant?.schemaName || `tenant_${businessId?.replace(/-/g, '_')}`;
            
            console.log('\n✅ Onboarding successful');
            console.log(`   Business ID: ${businessId}`);
            console.log(`   Schema Name: ${schemaName}`);
        } else {
            console.error('\n❌ Onboarding failed:', result.message);
        }
        
        // Step 4: Inspect database
        if (businessId && schemaName) {
            await inspectDatabase(businessId, schemaName);
        }
        
        // Final summary
        console.log('\n' + '='.repeat(80));
        console.log('📊 DEBUG COMPLETE - SUMMARY');
        console.log('='.repeat(80));
        console.log('\n✅ All steps completed');
        console.log(`   Business ID: ${businessId}`);
        console.log(`   Schema: ${schemaName}`);
        console.log(`   Business Email: ${TEST_CONFIG.businessEmail}`);
        console.log(`   Admin Email: ${TEST_CONFIG.adminEmail}`);
        console.log(`   Admin Password: ${TEST_CONFIG.adminPassword}`);
        console.log('\n🔧 You can now test login with:');
        console.log(`   curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"email":"${TEST_CONFIG.adminEmail}","password":"${TEST_CONFIG.adminPassword}"}'`);
        console.log('');
        
    } catch (error) {
        console.error('\n💥 Fatal error:', error.message);
        console.error(error.stack);
    } finally {
        await controlPlaneSequelize.close();
        process.exit(0);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { resetDatabase, runOnboardingWithDebug, inspectDatabase };
