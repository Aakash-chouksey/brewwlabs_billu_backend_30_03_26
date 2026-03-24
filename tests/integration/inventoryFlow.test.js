const axios = require('axios');

const API_BASE = 'http://127.0.0.1:8000';

async function runTests() {
    console.log('🧪 Starting Inventory Flow Verification...\n');

    let adminToken = '';
    let outletId = '';
    let brandId = '';

    try {
        // Step 0: Onboard a new business
        console.log('🏢 Step 0: Onboarding new business...');
        const onboardRes = await axios.post(`${API_BASE}/api/user/onboard`, {
            businessName: `Inventory Test Café ${Date.now()}`,
            businessEmail: `inv-test-${Date.now()}@example.com`,
            adminName: 'Inv Admin',
            adminEmail: `inv-admin-${Date.now()}@example.com`,
            adminPassword: 'Password@123',
            businessPhone: '1234567890',
            businessAddress: '123 Inv St',
            cafeType: 'SOLO'
        });
        
        brandId = onboardRes.data.data.brandId;
        outletId = onboardRes.data.data.outletId;
        console.log('✅ Onboarding successful.');

        // Step 1: Login
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

        // Step 2: Verify Seeded Inventory Categories
        console.log('\n🌱 Step 2: Verifying Seeded Inventory Categories...');
        const catListRes = await axios.get(`${API_BASE}/api/tenant/inventory-categories`, { headers });
        const seededCats = catListRes.data.data;
        console.log(`✅ Found ${seededCats.length} seeded categories:`, seededCats.map(c => c.name).join(', '));
        
        if (seededCats.length === 0) {
            throw new Error('No inventory categories were seeded during onboarding');
        }

        const coffeeCat = seededCats.find(c => c.name === 'Coffee');
        if (!coffeeCat) throw new Error('Missing "Coffee" seeded category');

        // Step 3: Create Custom Inventory Category
        console.log('\n🏷️ Step 3: Creating Custom Inventory Category...');
        const customCatRes = await axios.post(`${API_BASE}/api/tenant/inventory-categories`, { name: 'Cleaning Supplies' }, { headers });
        const customCatId = customCatRes.data.data.id;
        console.log('✅ Custom Category created:', customCatId);

        // Step 4: Add Inventory Stock (Create New Item)
        console.log('\n📦 Step 4: Adding New Inventory Item (Stock)...');
        const addItemRes = await axios.post(`${API_BASE}/api/tenant/inventory`, {
            name: 'Arabica Beans',
            quantity: 10,
            unit: 'kg',
            inventoryCategoryId: coffeeCat.id,
            minimumStock: 2
        }, { headers });
        console.log('✅ Inventory item created:', addItemRes.data.data.name, 'with qty:', addItemRes.data.data.currentStock);

        // Step 5: Update Existing Stock
        console.log('\n🔄 Step 5: Updating Existing Inventory Stock...');
        const updateStockRes = await axios.post(`${API_BASE}/api/tenant/inventory`, {
            name: 'Arabica Beans',
            quantity: 5, // Adding 5 more
            inventoryCategoryId: coffeeCat.id
        }, { headers });
        console.log('✅ Inventory stock updated. New qty:', updateStockRes.data.data.currentStock);
        
        if (Number(updateStockRes.data.data.currentStock) !== 15) {
            throw new Error(`Expected stock 15, got ${updateStockRes.data.data.currentStock}`);
        }

        // Step 6: Get Inventory List
        console.log('\n📜 Step 6: Verifying Inventory List and Associations...');
        const getInvRes = await axios.get(`${API_BASE}/api/tenant/inventory`, { headers });
        const items = getInvRes.data.data;
        console.log(`✅ Found ${items.length} items in inventory.`);
        
        const beanItem = items.find(i => i.name === 'Arabica Beans');
        if (!beanItem) throw new Error('Arabica Beans not found in inventory list');
        
        if (!beanItem.categoryData || beanItem.categoryData.name !== 'Coffee') {
            console.log('Bean Item:', JSON.stringify(beanItem, null, 2));
            throw new Error('Inventory item missing correct category association');
        }
        console.log('✅ Association verified: "Arabica Beans" -> "Coffee"');

        console.log('\n═══════════════════════════════════════');
        console.log('✅ ALL INVENTORY FLOW TESTS PASSED!');
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
