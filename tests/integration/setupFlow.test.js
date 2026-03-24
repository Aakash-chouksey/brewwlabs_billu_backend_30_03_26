const axios = require('axios');

const API_BASE = 'http://127.0.0.1:8000';

async function runTests() {
    console.log('🧪 Starting POS Setup Flow Verification...\n');

    let adminToken = '';
    let outletId = '';
    let businessId = '';
    let brandId = '';

    try {
        // Step 0: Onboard a new business to get a fresh context
        console.log('🏢 Step 0: Onboarding new business...');
        const onboardRes = await axios.post(`${API_BASE}/api/user/onboard`, {
            businessName: `Test Café ${Date.now()}`,
            businessEmail: `test-${Date.now()}@example.com`,
            adminName: 'Test Admin',
            adminEmail: `admin-${Date.now()}@example.com`,
            adminPassword: 'Password@123',
            businessPhone: '1234567890',
            businessAddress: '123 Test St',
            cafeType: 'SOLO'
        });
        
        brandId = onboardRes.data.data.brandId;
        outletId = onboardRes.data.data.outletId;
        console.log('✅ Onboarding successful.');

        // Step 1: Login to get token
        console.log('\n🔐 Step 1: Logging in...');
        const loginRes = await axios.post(`${API_BASE}/api/auth/login`, {
            email: onboardRes.data.data.adminUser.email,
            password: 'Password@123'
        });
        adminToken = loginRes.headers['set-cookie'][0].split(';')[0];
        console.log('✅ Login successful.');

        const headers = {
            'Cookie': adminToken,
            'x-brand-id': brandId,
            'x-outlet-id': outletId,
            'x-panel-type': 'TENANT'
        };

        // Step 2: Test Validation - Create table without area (Should fail)
        console.log('\n🚫 Step 2: Testing Validation (Creating table without area)...');
        try {
            await axios.post(`${API_BASE}/api/tenant/tables`, { name: 'Table 1', seats: 4 }, { headers });
            throw new Error('Should have failed without areaId');
        } catch (error) {
            if (error.response?.data?.message === 'Table area required.') {
                console.log('✅ Validation passed: Rejected table creation without area.');
            } else {
                throw error;
            }
        }

        // Step 3: Create Table Area
        console.log('\n📐 Step 3: Creating Table Area...');
        const areaRes = await axios.post(`${API_BASE}/api/tenant/areas`, { name: 'Main Floor' }, { headers });
        const areaId = areaRes.data.data.id;
        console.log('✅ Area created:', areaId);

        // Step 4: Create Table (Should succeed now)
        console.log('\n🪑 Step 4: Creating Table...');
        const tableRes = await axios.post(`${API_BASE}/api/tenant/tables`, { name: 'Table 1', seats: 4, areaId }, { headers });
        console.log('✅ Table created:', tableRes.data.data.id);

        // Step 5: Test Validation - Create product without category and product type (Should fail)
        console.log('\n🚫 Step 5: Testing Validation (Creating product without category)...');
        try {
            await axios.post(`${API_BASE}/api/tenant/products`, { name: 'Latte', price: 150 }, { headers });
            throw new Error('Should have failed without categoryId and productTypeId');
        } catch (error) {
            if (error.response?.data?.message === 'Category must exist before creating product.') {
                console.log('✅ Validation passed: Rejected product creation without category.');
            } else {
                throw error;
            }
        }

        // Step 6: Create Category
        console.log('\n📂 Step 6: Creating Category...');
        const catRes = await axios.post(`${API_BASE}/api/tenant/categories`, { name: 'Beverages' }, { headers });
        const categoryId = catRes.data.data.id;
        console.log('✅ Category created:', categoryId);

        // Step 7: Verify Seeded Product Types
        console.log('\n🌱 Step 7: Verifying Seeded Product Types...');
        const ptListRes = await axios.get(`${API_BASE}/api/tenant/product-types`, { headers });
        const seededTypes = ptListRes.data.data;
        console.log(`✅ Found ${seededTypes.length} seeded product types:`, seededTypes.map(t => t.name).join(', '));
        
        if (seededTypes.length === 0) {
            throw new Error('No product types were seeded during onboarding');
        }

        // Step 8: Create a custom Product Type
        console.log('\n🏷️ Step 8: Creating Custom Product Type...');
        const ptRes = await axios.post(`${API_BASE}/api/tenant/product-types`, { name: 'Starter' }, { headers });
        const customProductTypeId = ptRes.data.data.id;
        console.log('✅ Custom Product Type created:', customProductTypeId);

        // Step 9: Create Product using a seeded type (e.g., Veg)
        const vegType = seededTypes.find(t => t.name === 'Veg');
        console.log('\n☕ Step 9: Creating Product with seeded "Veg" type...');
        const prodRes = await axios.post(`${API_BASE}/api/tenant/products`, { 
            name: 'Veg Latte', 
            price: 150, 
            categoryId, 
            productTypeId: vegType.id 
        }, { headers });
        console.log('✅ Product created:', prodRes.data.data.id);

        console.log('\n═══════════════════════════════════════');
        console.log('✅ ALL POS SETUP FLOW TESTS PASSED!');
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
