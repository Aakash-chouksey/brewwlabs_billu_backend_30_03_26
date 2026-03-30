const onboardingService = require('../services/onboardingService');
const { sequelize } = require('../config/unified_database');
const Sequelize = require('sequelize');

async function testFreshOnboarding() {
    console.log('🚀 TESTING FRESH ONBOARDING...');
    
    const timestamp = Date.now();
    const testBusiness = {
        businessName: 'Audit Test Corp ' + timestamp,
        businessEmail: 'biz-' + timestamp + '@example.com',
        businessPhone: '1234567890',
        businessAddress: '123 Audit St',
        gstNumber: 'GST' + timestamp,
        adminName: 'Admin ' + timestamp,
        adminEmail: 'admin-' + timestamp + '@example.com',
        adminPassword: 'Password123!',
        cafeType: 'SOLO'
    };

    try {
        const result = await onboardingService.onboardBusiness(testBusiness);
        
        if (!result.success) {
            throw new Error(`Onboarding failed: ${result.message}`);
        }

        const { businessId, schemaName, status } = result.data;

        console.log(`✅ Onboarding successful! Business ID: ${businessId}, Schema: ${schemaName}`);

        // 1. Verify status is ACTIVE
        if (status !== 'ACTIVE') {
            throw new Error(`Onboarding status mismatch! Expected ACTIVE, got ${status}`);
        }
        console.log('✅ Tenant status is ACTIVE');

        // 2. Verify product_types table has 'status' column
        const columnCheck = await sequelize.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_schema = :schema AND table_name = 'product_types' AND column_name = 'status'
        `, { replacements: { schema: schemaName }, type: Sequelize.QueryTypes.SELECT });

        if (columnCheck.length === 0) {
            throw new Error(`MISSING COLUMN: 'status' in ${schemaName}.product_types`);
        }
        console.log(`✅ Column 'status' exists in ${schemaName}.product_types`);

        // 3. Verify at least one outlet exists
        const outletCheck = await sequelize.query(`
            SELECT id, name FROM "${schemaName}"."outlets" LIMIT 1
        `, { type: Sequelize.QueryTypes.SELECT });

        if (outletCheck.length === 0) {
            throw new Error(`MISSING OUTLET: No outlet found in ${schemaName}.outlets`);
        }
        console.log(`✅ Outlet found: ${outletCheck[0].name}`);

        // 4. Verify default data exists (Categories)
        const categoryCheck = await sequelize.query(`
            SELECT id, name FROM "${schemaName}"."categories" LIMIT 1
        `, { type: Sequelize.QueryTypes.SELECT });

        if (categoryCheck.length === 0) {
            throw new Error(`MISSING DEFAULT DATA: No categories found in ${schemaName}.categories`);
        }
        console.log(`✅ Default category found: ${categoryCheck[0].name}`);

        console.log('🎉 ALL VERIFICATION CHECKS PASSED FOR FRESH ONBOARDING!');
        return true;
    } catch (error) {
        console.error('❌ Onboarding Verification FAILED:', error.message);
        throw error;
    }
}

testFreshOnboarding()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Fatal Test Error:', err);
        process.exit(1);
    });
