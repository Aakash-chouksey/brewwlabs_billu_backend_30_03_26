const onboardingService = require('../../services/onboardingService');
const inventoryController = require('../../controllers/inventoryController');
const productController = require('../../controllers/productController');
const tenantModelLoader = require('../../src/architecture/tenantModelLoader');
const { sequelize, setInitializationPhase } = require('../../config/unified_database');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function runApiSmokeTest() {
    console.log('🧪 STARTING API SMOKE TEST (PHASE 5)');
    
    // Allow DDL for onboarding
    setInitializationPhase(true);

    const testData = {
        businessName: "Smoke Test Business " + Date.now(),
        businessEmail: `smoke_${uuidv4().slice(0, 8)}@test.com`,
        businessPhone: "9998887776",
        businessAddress: "456 Smoke Lane",
        gstNumber: "22BBBBB1111B1Z5",
        adminName: "Smoke Admin",
        adminEmail: `admin_${uuidv4().slice(0, 8)}@test.com`,
        adminPassword: "Password123!",
        cafeType: "CAFE"
    };

    try {
        // 1. ONBOARDING
        console.log('🏗️ 1. Onboarding fresh tenant...');
        const onboardResult = await onboardingService.onboardBusiness(testData);
        if (!onboardResult.success) throw new Error('Onboarding failed');
        
        const { schemaName, businessId, adminId } = onboardResult.data;
        const outletId = (await tenantModelLoader.getTenantModels(sequelize, schemaName)).Outlet.findOne({ where: { businessId } }).then(o => o?.id);
        
        // Mock request object helper
        const createMockReq = (body = {}, params = {}, query = {}) => ({
            businessId,
            outletId: null, // Will populate below
            auth: { id: adminId },
            body,
            params,
            query,
            readWithTenant: async (handler) => {
                const models = await tenantModelLoader.getTenantModels(sequelize, schemaName);
                return await handler({ transactionModels: models, sequelize });
            },
            executeWithTenant: async (handler) => {
                return await sequelize.transaction(async (t) => {
                    const models = await tenantModelLoader.getTenantModels(sequelize, schemaName);
                    return await handler({ transactionModels: models, transaction: t, sequelize });
                });
            }
        });

        // Get the default outlet created during onboarding
        const models = await tenantModelLoader.getTenantModels(sequelize, schemaName);
        const outlet = await models.Outlet.findOne({ where: { businessId } });
        const realOutletId = outlet.id;
        console.log(`✅ Tenant onboarded. Schema: ${schemaName}, Outlet: ${realOutletId}`);

        // 2. CREATE CATEGORY & PRODUCT (with SKU)
        console.log('📝 2. Creating category and product with SKU...');
        
        const category = await models.Category.create({
            businessId,
            outletId: realOutletId,
            name: "Beverages",
            isActive: true
        });
        console.log(`✅ Category created: ${category.name}`);

        // Create product
        const productResult = await models.Product.create({
            businessId,
            outletId: realOutletId,
            categoryId: category.id,
            name: "Smoke Coffee",
            sku: "COF-001",
            price: 5.50,
            currentStock: 10,
            isActive: true
        });
        console.log(`✅ Product created: ${productResult.name} (SKU: ${productResult.sku})`);

        // 3. GET ITEMS (Smoke Test)
        console.log('🔍 3. Testing GET /inventory/items...');
        const getItemsReq = createMockReq();
        getItemsReq.outletId = realOutletId;
        
        // Directly call inventory controller logic (simulated)
        const items = await getItemsReq.readWithTenant(async (context) => {
            const { transactionModels: m } = context;
            return await m.Inventory.findAll({
                where: { businessId, outletId: realOutletId },
                include: [{ model: m.Product, as: 'product' }]
            });
        });

        console.log(`✅ Found ${items.length} inventory items`);
        if (items.length > 0) {
            console.log(`🔎 Item 1 Product SKU: ${items[0].product?.sku || 'MISSING'}`);
            if (items[0].product?.sku !== "COF-001") {
                 throw new Error("SKU mismatch or visibility issue");
            }
        }

        // 4. ADD STOCK (Smoke Test)
        console.log('➕ 4. Testing POST /inventory/add...');
        const addStockData = {
            productId: productResult.id,
            quantity: 50,
            unitCost: 2.00,
            type: 'PURCHASE',
            notes: 'Restock via API test'
        };
        const addReq = createMockReq(addStockData);
        addReq.outletId = realOutletId;

        // Mock res for controller
        let capturedResponse;
        const mockRes = {
            status: (code) => ({ json: (data) => { capturedResponse = data; return data; } }),
            json: (data) => { capturedResponse = data; return data; }
        };

        await inventoryController.addItem(addReq, mockRes, (err) => { if (err) throw err; });
        console.log(`✅ Stock added. New Quantity: ${capturedResponse.data.inventory.quantity}`);

        // 5. VERIFY TRANSACTIONS
        console.log('📜 5. Testing GET /inventory/transactions...');
        const txReq = createMockReq({}, {}, { productId: productResult.id });
        txReq.outletId = realOutletId;
        
        await inventoryController.getTransactions(txReq, mockRes, (err) => { if (err) throw err; });
        console.log(`✅ Found ${capturedResponse.data.length} transactions`);

        console.log('\n✨ ALL API SMOKE TESTS PASSED!');

    } catch (error) {
        console.error('❌ API Smoke Test Failed:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

runApiSmokeTest();
