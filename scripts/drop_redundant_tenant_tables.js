require('dotenv').config();
const { sequelize } = require('../config/unified_database');

async function dropRedundantTenantTables() {
    try {
        console.log("🔌 Connecting to database...");
        await sequelize.authenticate();
        
        // 1. Get all tenant schemas
        const [schemas] = await sequelize.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'tenant_%'
        `);
        
        console.log(`🔍 Found ${schemas.length} tenant schemas.`);
        
        for (const { schema_name: schemaName } of schemas) {
            console.log(`🧹 Cleaning schema: ${schemaName}...`);
            
            // Drop redundant tables if they exist
            // Using CASCADE to handle any internal FKs that might have been created
            await sequelize.query(`DROP TABLE IF EXISTS "${schemaName}"."businesses" CASCADE`);
            await sequelize.query(`DROP TABLE IF EXISTS "${schemaName}"."users" CASCADE`);
            await sequelize.query(`DROP TABLE IF EXISTS "${schemaName}"."auth" CASCADE`);
            
            console.log(`  ✅ ${schemaName} cleaned.`);
        }
        
        console.log("✨ ALL TENANT SCHEMAS CLEANED.");
        process.exit(0);
    } catch (error) {
        console.error("❌ ERROR DURING CLEANUP:", error.message);
        process.exit(1);
    }
}

dropRedundantTenantTables();
