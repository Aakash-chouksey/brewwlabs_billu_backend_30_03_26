const axios = require('axios');

async function testOnboarding() {
    console.log('🚀 TESTING ONBOARDING FLOW...');
    
    // Test data for business onboarding
    const payload = {
        name: 'Billu Cafe ' + Math.floor(Math.random() * 1000),
        email: 'owner' + Math.floor(Math.random() * 1000) + '@billu.com',
        password: 'password123',
        adminName: 'Billu Admin',
        adminEmail: 'admin' + Math.floor(Math.random() * 1000) + '@billu.com',
        adminPassword: 'password123'
    };

    try {
        console.log(`📡 Sending POST /api/onboarding/business for ${payload.name}...`);
        const startTime = Date.now();
        const response = await axios.post('http://localhost:8000/api/onboarding/business', payload);
        const duration = Date.now() - startTime;

        if (response.data.success) {
            console.log('✅ ONBOARDING SUCCESSFUL!');
            console.log(`⏱️ Duration: ${duration}ms`);
            console.log('📦 Response Data:', JSON.stringify(response.data, null, 2));
            
            const tenantId = response.data.tenantId;
            console.log(`🏗️ Created Tenant ID: ${tenantId}`);
            console.log(`🔍 Verification Phase: Check schema tenant_${tenantId} in DB`);
            
            process.exit(0);
        } else {
            console.error('❌ ONBOARDING FAILED:', response.data.message);
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ ONBOARDING API ERROR:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Message:', error.message);
        }
        process.exit(1);
    }
}

testOnboarding();
