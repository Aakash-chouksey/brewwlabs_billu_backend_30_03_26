const axios = require('axios');

const API_BASE = 'http://127.0.0.1:8000';

async function runTests() {
    console.log('🧪 Starting Recipe-Inventory Integration Flow Verification...\n');

    let adminToken = '';
    let outletId = '';
    let brandId = '';

    try {
        // Step 0: Onboard a new business
        console.log('🏢 Step 0: Onboarding new business...');
        const onboardRes = await axios.post(`${API_BASE}/api/user/onboard`, {
            businessName: `Recipe Test Café ${Date.now()}`,
            businessEmail: `recipe-test-${Date.now()}@example.com`,
            adminName: 'Recipe Admin',
            adminEmail: `recipe-admin-${Date.now()}@example.com`,
            adminPassword: 'Password@123',
            businessPhone: '1234567890',
            businessAddress: '123 Recipe St',
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

        // Step 2: Get a seeded category
        const catListRes = await axios.get(`${API_BASE}/api/tenant/inventory-categories`, { headers });
        const coffeeCat = catListRes.data.data.find(c => c.name === 'Coffee') || catListRes.data.data[0];

        // Step 3: Create Inventory Item
        console.log('\n📦 Step 3: Creating Inventory Item (Coffee Beans)...');
        const itemRes = await axios.post(`${API_BASE}/api/tenant/inventory`, {
            name: 'Coffee Beans',
            unit: 'kg',
            quantity: 10,
            inventoryCategoryId: coffeeCat.id
        }, { headers });
        const inventoryItem = itemRes.data.data;
        console.log('✅ Inventory item created with stock: 10.000');

        // Step 4: Create Menu Category and Product
        console.log('\n☕ Step 4: Creating Menu Product (Espresso)...');
        
        // Fetch seeded product types
        const typeListRes = await axios.get(`${API_BASE}/api/tenant/product-types`, { headers });
        const productType = typeListRes.data.data.find(t => t.name === 'Veg') || typeListRes.data.data[0];

        const menuCatRes = await axios.post(`${API_BASE}/api/tenant/categories`, {
            name: 'Hot Coffee'
        }, { headers });
        const menuCat = menuCatRes.data.data;

        const productRes = await axios.post(`${API_BASE}/api/tenant/products`, {
            name: 'Espresso',
            price: 50,
            categoryId: menuCat.id,
            productTypeId: productType.id // Added missing field
        }, { headers });
        const product = productRes.data.data;
        console.log('✅ Product created: Espresso (50.00)');

        // Step 5: Create Recipe
        console.log('\n📖 Step 5: Creating Recipe for Espresso...');
        const recipeRes = await axios.post(`${API_BASE}/api/tenant/recipes`, {
            productId: product.id,
            name: 'Standard Espresso',
            instructions: '1. Grind beans. 2. Pull shot.',
            recipeItems: [
                {
                    inventoryItemId: inventoryItem.id,
                    quantityRequired: 0.1, // 100g or 0.1 units
                    unit: 'kg'
                }
            ]
        }, { headers });
        console.log('✅ Recipe created: Uses 0.1kg Coffee Beans per Espresso');

        // Step 6: Place Order
        console.log('\n🛒 Step 6: Placing Order (2 x Espresso)...');
        const orderRes = await axios.post(`${API_BASE}/api/tenant/orders`, {
            customerDetails: {
                name: 'Test Customer',
                phone: '9876543210'
            },
            items: [
                { productId: product.id, quantity: 2, price: 50, name: 'Espresso' }
            ],
            billing: {
                subTotal: 100,
                tax: 5,
                total: 105,
                paymentStatus: 'PENDING',
                paymentMethod: 'CASH'
            },
            orderStatus: 'CREATED'
        }, { headers });
        console.log('✅ Order placed successfully.');

        // Step 7: Verify Stock Deduction
        console.log('\n📉 Step 7: Verifying Inventory Stock Deduction...');
        const finalItemRes = await axios.get(`${API_BASE}/api/tenant/inventory`, { headers });
        const updatedItem = finalItemRes.data.data.find(i => i.id === inventoryItem.id);
        
        console.log(`📊 Initial Stock: 10.000`);
        console.log(`📊 Final Stock: ${updatedItem.currentStock}`);
        
        // Deduction should be 0.1 * 2 = 0.2. Remaining: 9.8
        const expectedStock = 9.8;
        if (Math.abs(Number(updatedItem.currentStock) - expectedStock) > 0.001) {
            throw new Error(`Expected stock ${expectedStock}, got ${updatedItem.currentStock}`);
        }
        console.log('✅ Stock deduction verified correctly!');

        console.log('\n═══════════════════════════════════════');
        console.log('✅ RECIPE-INVENTORY INTEGRATION PASSED!');
        console.log('═══════════════════════════════════════\n');

    } catch (error) {
        console.error('\n❌ Test Failed!');
        console.error('Error:', error.response?.data?.message || error.message);
        if (error.response?.data?.errorStack) {
            console.error('Stack:', error.response.data.errorStack);
        }
        process.exit(1);
    }
}

runTests();
