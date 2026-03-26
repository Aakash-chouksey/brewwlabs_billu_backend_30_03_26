const { Sequelize, DataTypes } = require('sequelize');
const inventorySaleModel = require('../models/inventorySaleModel');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: true
});

async function repairInventorySale() {
  try {
    const [schemas] = await sequelize.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%' LIMIT 1;");
    if (schemas.length === 0) {
        console.log("No tenant schemas found");
        return;
    }
    const schemaName = schemas[0].schema_name;
    console.log(`Repairing InventorySale schema for ${schemaName}...`);
    
    // Initialize ONLY the necessary model
    const InventorySale = inventorySaleModel(sequelize);
    const boundModel = InventorySale.schema(schemaName);
    
    // Use sync with alter: true
    await boundModel.sync({ force: false, alter: true });
    
    console.log("✅ InventorySale schema repaired successfully");
  } catch (error) {
    console.error("Error repairing InventorySale schema:", error.message);
  } finally {
    await sequelize.close();
  }
}

repairInventorySale();
