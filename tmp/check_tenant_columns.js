const { Sequelize, QueryTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});

async function checkColumns() {
  const schemaName = 'tenant_122fc271-af59-4e8e-b0ae-e1b63519872d';
  try {
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
    
    if (results.length === 0) {
        console.log("Table not found or no columns found.");
        return;
    }

    console.log(`Found ${results.length} columns:`);
    results.forEach(col => console.log(`- ${col.column_name} (${col.data_type})`));
  } catch (error) {
    console.error("Error checking columns:", error.message);
  } finally {
    await sequelize.close();
  }
}

checkColumns();
