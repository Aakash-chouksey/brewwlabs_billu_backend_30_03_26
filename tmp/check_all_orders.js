const { sequelize } = require('../config/unified_database');

async function checkAllOrders() {
    try {
        const schemas = await sequelize.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%' ");
        const schemaNames = schemas[0].map(s => s.schema_name);
        
        console.log(`Found ${schemaNames.length} tenant schemas.`);
        
        for (const schema of schemaNames) {
            try {
                const countRes = await sequelize.query(`SELECT count(*) as count FROM "${schema}"."orders"`);
                const count = parseInt(countRes[0][0].count);
                if (count > 0) {
                    console.log(`✅ ${schema}: ${count} orders`);
                } else {
                    console.log(`❌ ${schema}: 0 orders`);
                }
            } catch (err) {
                console.log(`⚠️ ${schema}: Error checking orders: ${err.message}`);
            }
        }
    } catch (err) {
        console.error('Fatal Error:', err);
    } finally {
        process.exit(0);
    }
}

checkAllOrders();
