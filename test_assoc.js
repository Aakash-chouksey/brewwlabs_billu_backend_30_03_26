const { sequelize } = require('./config/unified_database');
const tenantModelLoader = require('./src/architecture/tenantModelLoader');

async function testAssociations() {
    try {
        const schemaName = 'tenant_122fc271-af59-4e8e-b0ae-e1b63519872d';
        const models = await tenantModelLoader.getTenantModels(sequelize, schemaName);
        tenantModelLoader.setupAssociations(models, schemaName);

        const { InventorySale, Inventory, Product } = models;

        console.log('🔍 Testing InventorySale.findAll with Inventory and Product include...');
        const sales = await InventorySale.findAll({
            include: [
                { model: Inventory, as: 'inventory', attributes: ['id', 'quantity'] },
                { model: Product, as: 'product', attributes: ['id', 'name'] }
            ],
            limit: 1
        });

        console.log(`✅ Success! Found ${sales.length} sales.`);
    } catch (error) {
        console.error('❌ Association Test Failed:', error.message);
        if (error.original) console.error('Original error:', error.original.message);
    } finally {
        process.exit(0);
    }
}

testAssociations();
