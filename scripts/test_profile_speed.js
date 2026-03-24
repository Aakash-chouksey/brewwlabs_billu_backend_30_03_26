const axios = require('axios');

async function testLatency() {
    try {
        console.log("🚀 Testing Latency for stabilized APIs...");
        
        // 1. Login
        const loginStartTime = Date.now();
        const loginRes = await axios.post('http://localhost:8000/api/auth/login', {
            email: 'admin2@cafe.com', 
            password: 'Password@123'
        });
        const loginTime = Date.now() - loginStartTime;
        console.log(`✅ Login executed in ${loginTime}ms`);
        
        const token = loginRes.data.accessToken || loginRes.data?.data?.accessToken;
        
        // 2. Test /profile (Phase 6 requirement)
        const profileStartTime = Date.now();
        const profileRes = await axios.get('http://localhost:8000/api/tenant/profile', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const profileTime = Date.now() - profileStartTime;
        
        console.log(`✅ Profile retrieved in ${profileTime}ms`);
        if (profileTime > 500) {
            console.error(`❌ FAILURE: Profile latency ${profileTime}ms exceeds 500ms threshold!`);
            process.exit(1);
        }

        // 3. Test /products (to test association fixes and general scale)
        const productsStartTime = Date.now();
        const productsRes = await axios.get('http://localhost:8000/api/tenant/inventory', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const productsTime = Date.now() - productsStartTime;
        
        console.log(`✅ Products retrieved in ${productsTime}ms`);
        if (productsTime > 500) {
            console.error(`❌ FAILURE: Products latency ${productsTime}ms exceeds 500ms threshold!`);
            process.exit(1);
        }

        console.log("🎉 ALL LATENCY CHECKS PASSED. SYSTEM STABILIZED!");
        process.exit(0);

    } catch (err) {
        console.error("❌ Test failed:", err.message);
        if (err.response) {
            console.error("Response Status:", err.response.status);
            console.error("Response Data:", err.response.data);
        }
        process.exit(1);
    }
}

testLatency();
