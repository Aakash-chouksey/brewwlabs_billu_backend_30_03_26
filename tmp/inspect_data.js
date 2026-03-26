const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});

async function inspectData() {
  const schemaName = 'tenant_122fc271-af59-4e8e-b0ae-e1b63519872d';
  try {
    console.log(`Inspecting data in ${schemaName}.inventory_sales...`);
    
    const [rows] = await sequelize.query(`SELECT * FROM "${schemaName}"."inventory_sales" LIMIT 10`);
    
    console.log(`Found ${rows.length} rows.`);
    
    for (const row of rows) {
        console.log("Row ID:", row.id);
        try {
            const str = JSON.stringify(row);
            console.log("Stringify Success (len):", str.length);
        } catch (e) {
            console.error("Stringify FAIL for row:", row.id, e.message);
        }
    }
    
    console.log("✅ Data inspection completed.");
  } catch (error) {
    console.error("Error inspecting data:", error.message);
  } finally {
    await sequelize.close();
  }
}

inspectData();
