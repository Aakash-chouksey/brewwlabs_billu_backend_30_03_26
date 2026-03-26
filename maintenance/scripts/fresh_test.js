console.log('=== FRESH ONBOARDING + LOGIN TEST ===');

async function freshTest() {
    try {
        require('dotenv').config();
        
        // Step 1: Fresh Onboarding
        console.log('\n🚀 STEP 1: Fresh Onboarding');
        const onboardingService = require('../../services/onboarding.service');
        
        const timestamp = Date.now();
        const testData = {
            businessName: `Fresh Test Cafe ${timestamp}`,
            businessEmail: `freshtest${timestamp}@cafe.com`,
            businessPhone: '+1234567890',
            businessAddress: '123 Test Street',
            gstNumber: '123456789012345',
            adminName: 'Fresh Test Admin',
            adminEmail: `freshadmin${timestamp}@cafe.com`,
            adminPassword: 'Password123!',
            cafeType: 'SOLO'
        };
        
        console.log('Creating business with:', {
            businessEmail: testData.businessEmail,
            adminEmail: testData.adminEmail
        });
        
        const onboardingResult = await onboardingService.onboardBusiness(testData);
        
        console.log('✅ Onboarding successful!');
        console.log('📊 Business ID:', onboardingResult.businessId);
        console.log('📊 Admin Email:', testData.adminEmail);
        console.log('📊 Admin Password:', testData.adminPassword);
        
        // Step 2: Test Login with exact credentials
        console.log('\n🔑 STEP 2: Testing Login');
        
        // Test login using curl-like approach
        const authService = require('../../src/auth/auth.service');
        
        try {
            const loginResult = await authService.login(
                testData.adminEmail, 
                testData.adminPassword
            );
            
            console.log('✅ Login successful!');
            console.log('📊 User ID:', loginResult.id);
            console.log('📊 User Email:', loginResult.email);
            console.log('📊 User Role:', loginResult.role);
            
        } catch (loginError) {
            console.error('❌ Login failed:', loginError.message);
        }
        
    } catch (error) {
        console.error('💥 Test failed:', error.message);
    }
}

freshTest();
