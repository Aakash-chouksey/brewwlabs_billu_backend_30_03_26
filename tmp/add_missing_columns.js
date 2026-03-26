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
    
    // Check if columns exist first to avoid errors
    const [columns] = await sequelize.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = :schema AND table_name = 'inventory_sales'
    `, {
        replacements: { schema: schemaName },
        type: sequelize.QueryTypes.SELECT
    });
    
    const columnNames = columns.map(c => c.column_name);
    
    if (!columnNames.includes('outlet_id')) {
        console.log("Adding outlet_id...");
        await sequelize.query(`ALTER TABLE "${schemaName}"."inventory_sales" ADD COLUMN "outlet_id" UUID`);
    }
    
    if (!columnNames.includes('product_id')) {
        console.log("Adding product_id...");
        await sequelize.query(`ALTER TABLE "${schemaName}"."inventory_sales" ADD COLUMN "product_id" UUID`);
    }
    
    if (!columnNames.includes('customer_id')) {
        console.log("Adding customer_id...");
        await sequelize.query(`ALTER TABLE "${schemaName}"."inventory_sales" ADD COLUMN "customer_id" UUID`);
    }
    
    console.log("✅ Missing columns added successfully");
  } catch (error) {
    console.error("Error adding columns:", error.message);
  } finally {
    await sequelize.close();
  }
}

addMissingColumns();
