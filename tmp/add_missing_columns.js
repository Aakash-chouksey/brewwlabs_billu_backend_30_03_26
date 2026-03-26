const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: true
});

async function addMissingColumns() {
  const schemaName = 'tenant_122fc271-af59-4e8e-b0ae-e1b63519872d';
  try {
    console.log(`Adding missing columns to ${schemaName}.inventory_sales...`);
    
    await sequelize.query(`ALTER TABLE "${schemaName}"."inventory_sales" ADD COLUMN IF NOT EXISTS "outlet_id" UUID`);
    console.log("Adding outlet_id...");
    
    await sequelize.query(`ALTER TABLE "${schemaName}"."inventory_sales" ADD COLUMN IF NOT EXISTS "product_id" UUID`);
    console.log("Adding product_id...");
    
    await sequelize.query(`ALTER TABLE "${schemaName}"."inventory_sales" ADD COLUMN IF NOT EXISTS "customer_id" UUID`);
    console.log("Adding customer_id...");
    
    console.log("✅ Missing columns check/add completed successfully");
  } catch (error) {
    console.error("Error adding columns:", error.message);
  } finally {
    await sequelize.close();
  }
}

addMissingColumns();
