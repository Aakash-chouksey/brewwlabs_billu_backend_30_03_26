const axios = require('axios');

async function testOnboarding() {
    const data = {
        businessName: "Test Speed Biz " + Date.now(),
        businessEmail: "speedtest" + Date.now() + "@test.com",
        adminName: "Test Admin",
        adminEmail: "speedadmin" + Date.now() + "@test.com",
        adminPassword: "password123",
        cafeType: "SOLO"
    };

    console.log('🚀 Sending onboarding request...');
    const startTime = Date.now();
    
    try {
        const response = await axios.post('http://localhost:8000/api/onboarding/business', data);
        const duration = Date.now() - startTime;
        
        console.log('✅ Response received in ' + duration + 'ms');
        console.log('Response Status:', response.status);
        console.log('Response Data:', JSON.stringify(response.data, null, 2));

        const tenantId = response.data.tenantId;
        const status = response.data.status;

        if (status === 'CREATING') {
            console.log('📊 Status is CREATING as expected.');
        } else {
            console.error('❌ Unexpected status:', status);
        }

        // Test readiness guard (should return 503)
        console.log('\n🛡️ Testing readiness guard (expecting 503)...');
        try {
            await axios.get(`http://localhost:8000/api/tenant/outlets`, {
                headers: { 'x-business-id': tenantId }
            });
            console.error('❌ Error: Request should have been blocked with 503');
        } catch (err) {
            if (err.response && err.response.status === 503) {
                console.log('✅ Correctly blocked with 503: ' + err.response.data.message);
            } else {
                console.error('❌ Unexpected error response:', err.response ? err.response.status : err.message);
            }
        }

        // Poll for READY status
        console.log('\n🕒 Polling for READY status (this may take 10-30s)...');
        let isReady = false;
        const pollStart = Date.now();
        
        while (!isReady && (Date.now() - pollStart < 120000)) { // 2 minute timeout
            await new Promise(res => setTimeout(res, 5000));
            
            try {
                const checkRes = await axios.get(`http://localhost:8000/api/tenant/outlets`, {
                    headers: { 'x-business-id': tenantId }
                });
                
                if (checkRes.status === 200) {
                    console.log('🎉 Tenant is READY! (took ' + (Date.now() - pollStart) + 'ms to migrate)');
                    isReady = true;
                    console.log('Sample Data (Outlets):', checkRes.data.data.length);
                }
            } catch (err) {
                if (err.response && err.response.status === 503) {
                    console.log('...still setup in progress (503)...');
                } else {
                    console.error('...polling error: ' + (err.response ? err.response.status : err.message));
                }
            }
        }

        if (!isReady) {
            console.error('❌ Timeout waiting for tenant to become READY');
        }

    } catch (error) {
        console.error('❌ Onboarding request failed:', error.response ? error.response.data : error.message);
    }
}

testOnboarding();
