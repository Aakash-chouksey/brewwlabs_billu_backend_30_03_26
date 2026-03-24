require('dotenv').config();

async function testOnboarding() {
    try {
        console.log('🔍 Testing onboarding service directly...');
        
        const onboardingService = require('./services/onboarding.service');
        
        const testData = {
            businessName: 'Test Direct Cafe',
            businessEmail: 'directtest@cafe.com',
            businessPhone: '+1234567890',
            businessAddress: '123 Test Street',
            gstNumber: '123456789012345',
            adminName: 'Test Admin',
            adminEmail: 'admindirect@cafe.com',
            adminPassword: 'Password123!',
            cafeType: 'SOLO'
        };
        
        console.log('🚀 Starting onboarding test...');
        const result = await onboardingService.onboardBusiness(testData);
        
        console.log('✅ Onboarding successful:', result);
        
    } catch (error) {
        console.error('❌ Onboarding failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testOnboarding();
