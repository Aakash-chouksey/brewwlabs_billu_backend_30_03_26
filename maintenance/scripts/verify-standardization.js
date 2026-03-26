const axios = require('axios');

const API_URL = 'http://localhost:8000/api';

async function verifyStandardization() {
    console.log('🚀 Starting Final Verification for Tenant Standardization...');

    try {
        // 1. Test Onboarding
        console.log('\n--- 1. Testing Onboarding ---');
        const onboardingData = {
            businessName: 'Verification Test Biz ' + Date.now(),
            businessEmail: 'test' + Date.now() + '@example.com',
            adminName: 'Test Admin',
            adminEmail: 'admin' + Date.now() + '@example.com',
            adminPassword: 'Password123!',
            businessPhone: '1234567890',
            businessAddress: '123 Test St',
            cafeType: 'SOLO'
        };

        const onboardRes = await axios.post(`${API_URL}/onboarding/business`, onboardingData);
        console.log('✅ Onboarding Response:', JSON.stringify(onboardRes.data, null, 2));

        const { businessId } = onboardRes.data.data;
        if (!businessId) throw new Error('Onboarding failed: Missing businessId');
        if (onboardRes.data.brandId) throw new Error('Onboarding failed: brandId still present in response!');

        // 2. Test Login
        console.log('\n--- 2. Testing Login ---');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: onboardingData.adminEmail,
            password: onboardingData.adminPassword
        });
        
        const token = loginRes.data.accessToken;
        console.log('✅ Login Successful. Token received.');

        // 3. Decode JWT and Check Payload
        console.log('\n--- 3. Verifying JWT Payload ---');
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token);
        console.log('✅ JWT Payload:', JSON.stringify(decoded, null, 2));

        if (!decoded.businessId) throw new Error('JWT failed: Missing businessId');
        if (decoded.brandId) throw new Error('JWT failed: brandId still present in token!');

        // 4. Test Tenant Context Middleware
        console.log('\n--- 4. Testing Tenant Context Middleware ---');
        const authHeader = { 
            headers: { 
                Authorization: `Bearer ${token}`,
                'x-panel-type': 'TENANT'
            } 
        };
        const productsRes = await axios.get(`${API_URL}/tenant/products`, authHeader);
        console.log('✅ Products API Response (Status):', productsRes.status);

        console.log('\n🎉 ALL VERIFICATION STEPS PASSED!');
        console.log('Standardized Tenant Identity (businessId) is confirmed across Onboarding, Login, and API Middleware.');

    } catch (error) {
        console.error('\n❌ VERIFICATION FAILED:');
        if (error.response) {
            console.error('Response Data:', error.response.data);
            console.error('Response Status:', error.response.status);
        } else {
            console.error('Error Message:', error.message);
        }
        process.exit(1);
    }
}

verifyStandardization();
