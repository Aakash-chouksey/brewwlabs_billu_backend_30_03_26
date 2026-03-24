const axios = require('axios');

const API_BASE = 'http://127.0.0.1:8000';

async function runTests() {
    console.log('🧪 Starting Multi-Tenant Flow Verification...\n');

    try {
        // Test 1: Register Solo Cafe
        console.log('🏢 Test 1: Registering Solo Cafe...');
        const soloData = {
            businessName: `Solo Cafe ${Date.now()}`,
            businessEmail: `solo-${Date.now()}@example.com`,
            adminName: 'Solo Admin',
            adminEmail: `admin-solo-${Date.now()}@example.com`,
            adminPassword: 'Password@123',
            businessPhone: '1234567890',
            businessAddress: '123 Solo St',
            cafeType: 'SOLO'
        };

        const soloResponse = await axios.post(`${API_BASE}/api/user/onboard`, soloData);
        console.log('✅ Solo Onboarding Status:', soloResponse.status);
        console.log('✅ Solo Brand ID:', soloResponse.data.data.brandId);
        console.log('✅ Solo Outlet ID:', soloResponse.data.data.outletId);

        if (!soloResponse.data.data.outletId) {
            throw new Error('Solo cafe should have a default outlet ID');
        }

        // Test 2: Register Franchise Cafe
        console.log('\n🏢 Test 2: Registering Franchise Cafe...');
        const franchiseData = {
            businessName: `Franchise Group ${Date.now()}`,
            businessEmail: `franchise-${Date.now()}@example.com`,
            adminName: 'Franchise Admin',
            adminEmail: `admin-fran-${Date.now()}@example.com`,
            adminPassword: 'Password@123',
            businessPhone: '0987654321',
            businessAddress: '456 Franchise Ave',
            cafeType: 'FRANCHISE',
            brandName: 'Grand Legacy Brand'
        };

        const franResponse = await axios.post(`${API_BASE}/api/user/onboard`, franchiseData);
        console.log('✅ Franchise Onboarding Status:', franResponse.status);
        console.log('✅ Franchise Brand ID:', franResponse.data.data.brandId);
        console.log('✅ Franchise Brand Name:', franResponse.data.data.brandName);
        console.log('✅ Franchise Outlet ID (should be null):', franResponse.data.data.outletId);

        if (franResponse.data.data.outletId) {
            throw new Error('Franchise cafe should NOT have a default outlet ID');
        }

        // Test 3: Login as Solo Admin
        console.log('\n🔐 Test 3: Logging in as Solo Admin...');
        const loginResponse = await axios.post(`${API_BASE}/api/auth/login`, {
            email: soloData.adminEmail,
            password: soloData.adminPassword
        });

        console.log('✅ Login Status:', loginResponse.status);
        const loggedInUser = loginResponse.data.user;
        console.log('✅ User Outlets Count:', loggedInUser.outlets.length);
        
        if (loggedInUser.outlets.length !== 1) {
            throw new Error('Solo admin should have exactly 1 outlet');
        }

        console.log('\n═══════════════════════════════════════');
        console.log('✅ ALL INTEGRATION TESTS PASSED!');
        console.log('═══════════════════════════════════════\n');

    } catch (error) {
        console.error('\n❌ Test Failed!');
        console.error('Error:', error.response?.data?.message || error.message);
        if (error.response?.data) {
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    }
}

runTests();
