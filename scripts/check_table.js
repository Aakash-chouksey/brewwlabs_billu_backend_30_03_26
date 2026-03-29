const { sequelize } = require('../config/unified_database');

async function checkTable() {
    const schema = process.argv[2] || 'public';
    const table = process.argv[3] || 'tenant_registry';
    
    try {
        console.log(`🔍 Checking table ${schema}.${table} info...`);
        const [results] = await sequelize.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = :schema AND table_name = :table
            ORDER BY column_name;
        `, {
            replacements: { schema, table }
        });
        
        if (results.length === 0) {
            console.log(`❌ Table ${schema}.${table} not found.`);
        } else {
            console.table(results);
        }
        process.exit(0);
    } catch (error) {
        console.error('❌ Error checking table:', error.message);
        process.exit(1);
    }
}

checkTable();
