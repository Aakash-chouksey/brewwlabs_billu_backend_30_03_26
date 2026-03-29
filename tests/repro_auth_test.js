const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 8000;
const API_URL = `http://localhost:${PORT}/api`;
const RANDOM_ID = uuidv4().split('-')[0];
const TEST_EMAIL = `test_${RANDOM_ID}@brewwlabs.com`;
const TEST_PASSWORD = 'password123';

async function runTest() {
    console.log(`🚀 Starting Auth System Test with ID: ${RANDOM_ID}`);
    console.log(`📧 Test Email: ${TEST_EMAIL}`);

    try {
        // 1. Onboarding
        console.log('\n--- STEP 1: Onboarding ---');
        const onboardingRes = await axios.post(`${API_URL}/onboarding/business`, {
            businessName: `Test Business ${RANDOM_ID}`,
            businessEmail: TEST_EMAIL,
            businessPhone: '1234567890',
            businessAddress: '123 Test St',
            adminName: `Admin ${RANDOM_ID}`,
            adminEmail: TEST_EMAIL,
            adminPassword: TEST_PASSWORD
        });

        console.log('✅ Onboarding Response:', JSON.stringify(onboardingRes.data, null, 2));
        const businessId = onboardingRes.data.tenantId;
        const tenantId = businessId; // tenantId is businessId in this architecture

        // 2. Poll for Readiness
        console.log('\n--- STEP 2: Waiting for Tenant Readiness ---');
        let isReady = false;
        let attempts = 0;
        const maxAttempts = 20;

        while (!isReady && attempts < maxAttempts) {
            attempts++;
            console.log(`⌛ Checking status (attempt ${attempts}/${maxAttempts})...`);
            
            // We'll check the debug endpoint or just try to login
            try {
                const loginRes = await axios.post(`${API_URL}/auth/login`, {
                    email: TEST_EMAIL,
                    password: TEST_PASSWORD
                });

                if (loginRes.data.success) {
                    console.log('✅ Tenant is READY and login successful!');
                    isReady = true;
                    const token = loginRes.data.accessToken;

                    // 3. Verify Me
                    console.log('\n--- STEP 3: Verifying User Profile ---');
                    const meRes = await axios.get(`${API_URL}/auth/me`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    console.log('✅ User Profile:', JSON.stringify(meRes.data, null, 2));
                    
                    if (meRes.data.user.email === TEST_EMAIL) {
                        console.log('🎉 TEST PASSED SUCCESSFULLY!');
                    } else {
                        console.error('❌ User profile mismatch!');
                        process.exit(1);
                    }
                }
            } catch (err) {
                if (err.response && err.response.status === 401) {
                    console.log('⏳ Tenant not ready yet (Login failed with 401)');
                } else if (err.response && err.response.status === 500) {
                    console.log(`❌ Server error: ${err.response.data.message}`);
                    // If it's a schema issue, we might want to fail fast
                    if (err.response.data.message.includes('relation') || err.response.data.message.includes('column')) {
                        console.error('🚨 SCHEMA ERROR DETECTED!');
                        process.exit(1);
                    }
                } else {
                    console.log(`⏳ Waiting... (${err.message})`);
                }
            }

            if (!isReady) {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }

        if (!isReady) {
            console.error('❌ Timeout waiting for tenant readiness');
            process.exit(1);
        }

    } catch (error) {
        console.error('💥 Test failed with error:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
        process.exit(1);
    }
}

runTest();
