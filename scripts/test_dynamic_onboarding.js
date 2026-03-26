const onboardingService = require('../services/onboarding.service');
const { sequelize } = require('../config/unified_database');

async function testOnboarding() {
    console.log('🚀 STARTING DYNAMIC ONBOARDING TEST...');
    
    const testData = {
        businessName: 'Dynamic Test Cafe ' + Date.now(),
        businessEmail: 'test-' + Date.now() + '@cafe.com',
        businessPhone: '1234567890',
        businessAddress: '123 Tech Lane',
        gstNumber: 'GST' + Date.now(),
        adminName: 'Test Admin',
        adminEmail: 'admin-' + Date.now() + '@test.com',
        adminPassword: 'password123',
        cafeType: 'SOLO'
    };

    try {
        const result = await onboardingService.onboardBusiness(testData);
        console.log('✅ ONBOARDING SUCCESS:', JSON.stringify(result, null, 2));
        
        // Final Verification
        console.log('\n--- Final Verification ---');
        const status = await onboardingService.getOnboardingStatus(result.data.businessId);
        console.log('Status Check:', JSON.stringify(status, null, 2));
        
        if (status.data.isConsistent) {
            console.log('\n✨ [TEST PASSED] System is 100% consistent after dynamic onboarding!');
        } else {
            console.error('\n❌ [TEST FAILED] System is inconsistent after onboarding.');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ ONBOARDING FAILED:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

testOnboarding();
