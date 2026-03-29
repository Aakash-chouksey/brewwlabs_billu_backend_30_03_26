const { Sequelize } = require('sequelize');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URI;

if (!databaseUrl) {
    console.error('DATABASE_URL not found in .env');
    process.exit(1);
}

const isCloudDb = databaseUrl.includes('neon.tech') || databaseUrl.includes('aws');

const sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: {
        ...(isCloudDb && {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        })
    }
});

async function reset() {
    try {
        console.log('🔌 Connecting to database for full reset...');
        await sequelize.authenticate();
        console.log('✅ Connected to DB');

        // 1. Get all schemas except system catalogs
        const [schemas] = await sequelize.query(`
            SELECT schema_name FROM information_schema.schemata 
            WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
            AND schema_name NOT LIKE 'pg_temp_%'
            AND schema_name NOT LIKE 'pg_toast_temp_%'
        `);

        console.log(`🔍 Found ${schemas.length} schemas to drop.`);

        // 2. Drop all schemas
        for (const { schema_name } of schemas) {
            console.log(`🔥 Dropping schema: ${schema_name}`);
            await sequelize.query(`DROP SCHEMA IF EXISTS "${schema_name}" CASCADE`);
        }

        // 3. Recreate public schema (PostgreSQL default)
        // Some systems might have dropped it in step 2
        console.log('🏗️ Recreating public schema...');
        await sequelize.query('CREATE SCHEMA IF NOT EXISTS public');
        
        // 4. Set owner if needed (for Neon compliance)
        // neon_owner is typical, but we use the current user
        const [[{ current_user }]] = await sequelize.query('SELECT current_user');
        console.log(`👤 Setting owner of public schema to ${current_user}...`);
        await sequelize.query(`ALTER SCHEMA public OWNER TO "${current_user}"`);

        console.log('✨ FULL DATABASE RESET COMPLETE');
        process.exit(0);
    } catch (error) {
        console.error('❌ Reset failed:', error.message);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    }
}

reset();
