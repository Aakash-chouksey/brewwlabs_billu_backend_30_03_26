console.log('=== FOREIGN KEY FIX TEST ===');

async function testFix() {
    try {
        require('dotenv').config();
        console.log('✅ Environment loaded');
        
        // Test the onboarding service
        const onboardingService = require('./services/onboarding.service');
        console.log('✅ Onboarding service loaded');
        
        // Generate unique test data
        const timestamp = Date.now();
        const testData = {
            businessName: `FK Test Cafe ${timestamp}`,
            businessEmail: `fktest${timestamp}@cafe.com`,
            businessPhone: '+1234567890',
            businessAddress: '123 Test Street',
            gstNumber: '123456789012345',
            adminName: 'FK Test Admin',
            adminEmail: `fkadmin${timestamp}@cafe.com`,
            adminPassword: 'Password123!',
            cafeType: 'SOLO'
        };
        
        console.log('🚀 Testing onboarding with foreign key fix...');
        console.log('   Business:', testData.businessName);
        console.log('   Email:', testData.businessEmail);
        
        const result = await onboardingService.onboardBusiness(testData);
        
        console.log('✅ FOREIGN KEY FIX SUCCESSFUL!');
        console.log('📊 Results:');
        console.log('   Business ID:', result.businessId);
        console.log('   Database Name:', result.databaseName);
        console.log('   Outlet ID:', result.outletId);
        console.log('   Admin User ID:', result.adminUserId);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('🔍 Error details:', {
            name: error.name,
            stack: error.stack?.split('\n').slice(0, 5).join('\n')
        });
    }
}

testFix();
