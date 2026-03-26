const onboardingService = require('../../services/onboardingService');
const tenantModelLoader = require('../../src/architecture/tenantModelLoader');
const { sequelize, setInitializationPhase } = require('../../config/unified_database');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function verifyTenantCreation() {
    console.log('🚀 STARTING TENANT CREATION & VERIFICATION TEST');
    
    // Allow DDL for onboarding
    setInitializationPhase(true);

    const testData = {
        businessName: "Test Bakery " + Date.now(),
        businessEmail: `bakery_${uuidv4().slice(0, 8)}@test.com`,
        businessPhone: "9876543210",
        businessAddress: "123 Baker Street",
        gstNumber: "22AAAAA0000A1Z5",
        adminName: "Bakery Admin",
        adminEmail: `admin_${uuidv4().slice(0, 8)}@test.com`,
        adminPassword: "Password123!",
        cafeType: "BAKERY"
    };

    try {
        console.log('📝 Onboarding fresh tenant...');
        const result = await onboardingService.onboardBusiness(testData);
        
        if (!result.success) {
            throw new Error('Onboarding failed: ' + result.message);
        }

        const { schemaName, businessId } = result.data;
        console.log(`✅ Tenant created: ${schemaName} (Business ID: ${businessId})`);

        // 🛡️ SCHEMA AUDIT
        console.log('\n🛡️ RUNNING COMPREHENSIVE SCHEMA AUDIT...');
        const audit = await tenantModelLoader.verifySchemaIntegrity(sequelize, schemaName);

        console.log('-------------------------------------------');
        console.log(`Schema: ${schemaName}`);
        console.log(`Status: ${audit.isValid ? '✅ VALID' : '❌ INVALID'}`);
        console.log(`Total Issues: ${audit.issues}`);
        
        if (audit.missingTables.length > 0) {
            console.log('❌ MISSING TABLES:', audit.missingTables.join(', '));
        } else {
            console.log('✅ ALL REQUIRED TABLES EXIST');
        }

        if (audit.missingColumns.length > 0) {
            console.log('❌ MISSING COLUMNS:', audit.missingColumns.join(', '));
        } else {
            console.log('✅ ALL REQUIRED COLUMNS EXIST (including sku)');
        }
        console.log('-------------------------------------------');

        // Verification of specific critical tables requested by user
        const criticalTables = ['products', 'inventory', 'inventory_items', 'inventory_transactions'];
        const existingTables = await sequelize.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = :schema AND table_name IN (:tables)
        `, {
            replacements: { schema: schemaName, tables: criticalTables },
            type: sequelize.QueryTypes.SELECT
        });

        const foundNames = existingTables.map(t => t.table_name);
        const missingCritical = criticalTables.filter(t => !foundNames.includes(t));

        if (missingCritical.length > 0) {
            console.error(`🚨 CRITICAL TABLES MISSING: ${missingCritical.join(', ')}`);
        } else {
            console.log('✅ ALL CRITICAL TABLES VERIFIED');
        }

        if (audit.isValid && missingCritical.length === 0) {
            console.log('\n✨ TENANT CREATION TEST PASSED SUCCESSFULLY!');
        } else {
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Tenant Verification Failed:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

verifyTenantCreation();
