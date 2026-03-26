const { Sequelize, QueryTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});

async function checkColumns() {
  try {
    const [schemas] = await sequelize.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%' LIMIT 1;");
    if (schemas.length === 0) {
        console.log("No tenant schemas found");
        return;
    }
    const schemaName = schemas[0].schema_name;
    console.log(`Checking columns in ${schemaName}.inventory_sales...`);
    
    const results = await sequelize.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = :schema AND table_name = 'inventory_sales'
        ORDER BY column_name
    `, {
        replacements: { schema: schemaName },
        type: QueryTypes.SELECT
    });
    
    console.log(`Found ${results.length} columns:`);
    results.forEach(col => console.log(`- ${col.column_name} (${col.data_type})`));
  } catch (error) {
    console.error("Error checking columns:", error.message);
  } finally {
    await sequelize.close();
  }
}

checkColumns();
