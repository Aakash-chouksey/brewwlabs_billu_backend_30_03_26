const { Sequelize } = require('sequelize');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URI;
const isCloudDb = databaseUrl.includes('neon.tech') || databaseUrl.includes('aws');

const sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
        ...(isCloudDb && {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        })
    }
});

async function verify() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to DB');

        const tablesToVerify = ['businesses', 'users', 'tenant_registry'];
        const [tables] = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN (:tables)
        `, { replacements: { tables: tablesToVerify } });

        const foundTables = tables.map(t => t.table_name);
        console.log('Found tables:', foundTables);

        const missingTables = tablesToVerify.filter(t => !foundTables.includes(t));
        if (missingTables.length > 0) {
            console.error('❌ Missing tables:', missingTables);
        } else {
            console.log('✅ All public tables exist');
        }

        // Verify tenant_registry columns
        const [columns] = await sequelize.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'tenant_registry'
        `);

        const requiredColumns = ['business_id', 'schema_name', 'status', 'retry_count', 'last_error', 'activated_at'];
        const foundColumns = columns.map(c => c.column_name);
        
        const missingColumns = requiredColumns.filter(c => !foundColumns.includes(c));
        if (missingColumns.length > 0) {
            console.error('❌ Missing columns in tenant_registry:', missingColumns);
        } else {
            console.log('✅ All required columns exist in tenant_registry');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        process.exit(1);
    }
}

verify();
