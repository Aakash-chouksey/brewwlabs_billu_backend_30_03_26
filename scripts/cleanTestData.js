const { sequelize } = require('../config/database_postgres');
const { controlPlaneSequelize } = require('../config/control_plane_db');

async function cleanTestData() {
    try {
        console.log('🧹 Cleaning test data...');
        
        // Clean shared database
        console.log('🗑️  Cleaning shared database...');
        await sequelize.query('DELETE FROM users WHERE email LIKE \'%test%\' OR email LIKE \'%cafe%\'');
        await sequelize.query('DELETE FROM businesses WHERE email LIKE \'%test%\' OR email LIKE \'%cafe%\' OR name LIKE \'%Test%\'');
        await sequelize.query('DELETE FROM outlets WHERE name LIKE \'%Test%\'');
        await sequelize.query('DELETE FROM product_types WHERE brandId IN (SELECT id FROM brands WHERE name LIKE \'%Test%\')');
        await sequelize.query('DELETE FROM inventory_categories WHERE brandId IN (SELECT id FROM brands WHERE name LIKE \'%Test%\')');
        
        // Clean control plane
        console.log('🗑️  Cleaning control plane...');
        await controlPlaneSequelize.query('DELETE FROM brands WHERE name LIKE \'%Test%\' OR email LIKE \'%test%\'');
        
        console.log('✅ Test data cleaned successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error cleaning data:', error.message);
        process.exit(1);
    }
}

cleanTestData();
