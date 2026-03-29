const { sequelize } = require('../config/unified_database');

async function testConnection() {
    console.log('Testing connection...');
    try {
        await sequelize.authenticate();
        console.log('Connection authenticated.');
        
        console.log('Running query...');
        const result = await sequelize.query('SELECT 1 as connected', { type: sequelize.QueryTypes.SELECT });
        console.log('Query result:', result);
        
        process.exit(0);
    } catch (error) {
        console.error('Connection test failed:', error);
        process.exit(1);
    }
}

testConnection();
