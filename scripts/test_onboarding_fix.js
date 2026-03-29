/**
 * TEST ONBOARDING FIX
 * 
 * Verifies that the onboarding flow creates the schema correctly,
 * applies migrations, and sets the version table.
 */

const { sequelize, setInitializationPhase } = require('../config/unified_database');
const onboardingService = require('../services/onboardingService');
const { v4: uuidv4 } = require('uuid');

// Enable initialization phase to allow DDL and bypass strict runtime checks
setInitializationPhase(true);
process.env.SQL_LOGGING = 'true';

async function testOnboarding() {
    console.log('🚀 Starting onboarding fix verification...');
    
    // Generate unique names for this test run
    const testId = uuidv4().slice(0, 8);
    const businessName = `Test Business ${testId}`;
    const businessEmail = `biz-${testId}@test.local`;
    const adminEmail = `admin-${testId}@test.local`;
    const adminPassword = 'password123';
    
    const onboardingData = {
        businessName,
        businessEmail,
        businessPhone: '1234567890',
        businessAddress: '123 Test St',
        gstNumber: 'GST-TEST-' + testId,
        adminName: 'Test Admin',
        adminEmail,
        adminPassword,
        cafeType: 'SOLO'
    };

    try {
        // 1. Run Onboarding
        console.log(`[Test] Onboarding business: ${businessName} (${businessEmail})...`);
        const result = await onboardingService.onboardBusiness(onboardingData);
        
        if (!result.success) {
            console.error('❌ Onboarding failed:', result.message);
            process.exit(1);
        }
        
        const { schemaName, businessId } = result.data;
        console.log(`✅ Onboarding successful! Schema: ${schemaName}`);

        // 2. Verify Schema Exists
        const [schemaCheck] = await sequelize.query(`
            SELECT schema_name FROM information_schema.schemata WHERE schema_name = :schema
        `, { 
            replacements: { schema: schemaName }, 
            type: sequelize.QueryTypes.SELECT 
        });

        if (schemaCheck) {
            console.log(`✅ Verification: Schema ${schemaName} exists in database.`);
        } else {
            console.error(`❌ Verification FAILED: Schema ${schemaName} NOT found in database!`);
            process.exit(1);
        }

        // 3. Verify Tables Exist (Checking a few core ones)
        const coreTables = ['products', 'categories', 'orders', 'schema_versions', 'outlets'];
        const [tablesCheck] = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = :schema 
            AND table_name IN (:tables)
        `, {
            replacements: { schema: schemaName, tables: coreTables },
            type: sequelize.QueryTypes.SELECT
        });

        const existingTables = tablesCheck.map(t => t.table_name);
        console.log(`✅ Verification: Found ${existingTables.length}/${coreTables.length} core tables: ${existingTables.join(', ')}`);

        if (existingTables.length < coreTables.length) {
            const missing = coreTables.filter(t => !existingTables.includes(t));
            console.error(`❌ Verification FAILED: Missing tables: ${missing.join(', ')}`);
            process.exit(1);
        }

        // 4. Verify Schema Version
        const [versionCheck] = await sequelize.query(`
            SELECT MAX(version) as current_version FROM "${schemaName}"."schema_versions"
        `, { type: sequelize.QueryTypes.SELECT });

        if (versionCheck && versionCheck.current_version !== undefined) {
            console.log(`✅ Verification: Schema version is ${versionCheck.current_version}`);
        } else {
            console.error(`❌ Verification FAILED: Could not read schema version!`);
            process.exit(1);
        }

        console.log('\n✨ ALL VERIFICATIONS PASSED! The onboarding flow is fixed.');
        
        // Cleanup (Optional - keep for debugging or drop it)
        // await sequelize.query(`DROP SCHEMA "${schemaName}" CASCADE`);
        // console.log(`🧹 Cleaned up test schema: ${schemaName}`);

        process.exit(0);

    } catch (error) {
        console.error('🚨 TEST FAILED with unexpected error:', error.stack);
        process.exit(1);
    }
}

// Start the test
testOnboarding();
