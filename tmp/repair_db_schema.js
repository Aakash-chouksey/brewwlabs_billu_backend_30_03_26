const { Sequelize } = require('sequelize');
const tenantModelLoader = require('../src/architecture/tenantModelLoader');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: true // Enable logging to see what's happening
});

async function repairSchema() {
  try {
    const [schemas] = await sequelize.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%' LIMIT 1;");
    if (schemas.length === 0) {
        console.log("No tenant schemas found");
        return;
    }
    const schemaName = schemas[0].schema_name;
    console.log(`Repairing schema for ${schemaName}...`);
    
    const report = await tenantModelLoader.repairTenantSchema(sequelize, schemaName);
    console.log("Repair Report:", JSON.stringify(report, null, 2));
  } catch (error) {
    console.error("Error repairing schema:", error.message);
  } finally {
    await sequelize.close();
  }
}

repairSchema();
