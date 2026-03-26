
require('dotenv').config();
const { Sequelize } = require('sequelize');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
}

const sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    }
});

async function listSchemas() {
    try {
        const [results] = await sequelize.query("SELECT schema_name FROM information_schema.schemata");
        console.log('Available schemas:');
        results.forEach(row => console.log(` - ${row.schema_name}`));
        
        const [tables] = await sequelize.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
            ORDER BY table_schema, table_name
        `);
        console.log('\nTables:');
        tables.forEach(row => console.log(` - ${row.table_schema}.${row.table_name}`));
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await sequelize.close();
    }
}

listSchemas();
