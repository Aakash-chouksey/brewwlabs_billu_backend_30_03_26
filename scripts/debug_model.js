const { sequelize } = require('../config/unified_database');
const { ModelFactory } = require('../src/architecture/modelFactory');

async function debugModel() {
    try {
        console.log('🔍 Debugging TenantRegistry model...');
        const models = await ModelFactory.createModels(sequelize);
        const TenantRegistry = models.TenantRegistry;
        
        console.log('Model Name:', TenantRegistry.name);
        console.log('Attributes:', Object.keys(TenantRegistry.rawAttributes));
        
        const attr = TenantRegistry.rawAttributes.businessId;
        if (attr) {
            console.log('businessId field:', attr.field);
            console.log('businessId allowNull:', attr.allowNull);
        } else {
            console.log('❌ businessId NOT FOUND in attributes!');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

debugModel();
