const { sequelize } = require('../config/unified_database');

async function checkAllData() {
    try {
        const schemas = await sequelize.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%' ");
        const schemaNames = schemas[0].map(s => s.schema_name);
        
        console.log(`Found ${schemaNames.length} tenant schemas.`);
        
        for (const schema of schemaNames) {
            try {
                const ordersRes = await sequelize.query(`SELECT count(*) as count FROM "${schema}"."orders"`);
                const orders = parseInt(ordersRes[0][0].count);
                
                const itemsRes = await sequelize.query(`SELECT count(*) as count FROM "${schema}"."order_items"`);
                const items = parseInt(itemsRes[0][0].count);
                
                const productsRes = await sequelize.query(`SELECT count(*) as count FROM "${schema}"."products"`);
                const products = parseInt(productsRes[0][0].count);
                
                if (orders > 0 || items > 0 || products > 0) {
                    console.log(`✅ ${schema}: ${orders} orders, ${items} items, ${products} products`);
                } else {
                    console.log(`❌ ${schema}: Empty`);
                }
            } catch (err) {
                console.log(`⚠️ ${schema}: Error: ${err.message}`);
            }
        }
    } catch (err) {
        console.error('Fatal Error:', err);
    } finally {
        process.exit(0);
    }
}

checkAllData();
