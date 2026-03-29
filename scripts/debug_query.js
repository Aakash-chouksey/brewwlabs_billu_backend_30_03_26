const { sequelize, setInitializationPhase } = require('../config/unified_database');
const { Sequelize } = require('sequelize');

async function debugQuery() {
    setInitializationPhase(true);
    console.log('Testing query return type...');
    
    const result = await sequelize.query('SELECT 1 as val', { type: Sequelize.QueryTypes.SELECT });
    console.log('Result:', result);
    console.log('Is array?', Array.isArray(result));
    console.log('Type of result:', typeof result);
    
    process.exit(0);
}

debugQuery();
