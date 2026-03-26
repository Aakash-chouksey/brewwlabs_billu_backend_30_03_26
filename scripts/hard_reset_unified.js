const { sequelize } = require('../config/unified_database');
const Sequelize = require('sequelize');
require('dotenv').config();

async function hardReset() {
    console.log('🔥 STARTING UNIFIED DATABASE HARD RESET...');
    
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to database');

        // 1. Get all tenant schemas
        const [schemas] = await sequelize.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'tenant_%'
        `);

        console.log(`📦 Found ${schemas.length} tenant schemas to drop.`);

        // 2. Drop tenant schemas
        for (const schema of schemas) {
            const schemaName = schema.schema_name;
            console.log(`  🗑️  Dropping schema: ${schemaName}...`);
            await sequelize.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
        }

        // 3. Drop all tables in public schema
        console.log('🧹 Dropping all tables in public schema...');
        // We use cascade to handle dependencies
        await sequelize.query(`
            DO $$ DECLARE
                r RECORD;
            BEGIN
                FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                    EXECUTE 'DROP TABLE IF EXISTS "public"."' || r.tablename || '" CASCADE';
                END LOOP;
            END $$;
        `);

        console.log('✨ Database is now CLEAN (Schemas and Public Tables dropped).');
        
    } catch (error) {
        console.error('❌ Hard reset failed:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

hardReset();
