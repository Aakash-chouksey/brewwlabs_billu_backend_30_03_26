const { Sequelize } = require('sequelize');
require('dotenv').config();

async function runRealityCheck() {
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        logging: false,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        }
    });

    try {
        console.log("--- PHASE 1: TABLE DISTRIBUTION ---");
        const [tables] = await sequelize.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE (table_schema IN ('public') OR table_schema LIKE 'tenant_%')
            AND table_name NOT IN ('pg_stat_statements')
            ORDER BY table_schema, table_name;
        `);
        console.table(tables);

        console.log("\n--- PHASE 2: SCHEMA EXISTENCE ---");
        const [schemas] = await sequelize.query(`
            SELECT schema_name 
            FROM information_schema.schemata
            WHERE schema_name LIKE 'tenant_%' OR schema_name = 'public';
        `);
        console.table(schemas);

        await sequelize.close();
    } catch (error) {
        console.error("Error during reality check:", error);
        process.exit(1);
    }
}

runRealityCheck();
