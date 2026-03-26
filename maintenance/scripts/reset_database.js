const { Client } = require('pg');
const { sequelize, setInitializationPhase } = require('../../config/unified_database');
const { initializeControlPlaneModels } = require('../../config/control_plane_db');
require('dotenv').config();

async function resetDatabase() {
    console.log('🔥 STARTING COMPLETE DATABASE RESET...');
    
    // Enable DDL queries
    setInitializationPhase(true);

    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URI;
    
    if (!connectionString) {
        console.error('❌ DATABASE_URL or POSTGRES_URI not set in environment');
        process.exit(1);
    }

    const client = new Client({ 
        connectionString: connectionString, 
        ssl: { rejectUnauthorized: false } 
    });

    try {
        await client.connect();
        console.log('🔌 Connected to PostgreSQL for reset...');

        // 1. Drop all tenant schemas
        console.log('🗑️ Dropping all tenant schemas...');
        const dropTenantsSql = `
        DO $$ 
        DECLARE r RECORD;
        BEGIN
          FOR r IN (
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'tenant_%'
          ) LOOP
            EXECUTE 'DROP SCHEMA IF EXISTS "' || r.schema_name || '" CASCADE';
          END LOOP;
        END $$;
        `;
        await client.query(dropTenantsSql);
        console.log('✅ Tenant schemas dropped.');

        // 2. Clean public schema (Drop all tables in public)
        console.log('🧹 Cleaning public schema...');
        const cleanPublicSql = `
        DO $$ 
        DECLARE r RECORD;
        BEGIN
          FOR r IN (
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
          ) LOOP
            EXECUTE 'DROP TABLE IF EXISTS "public"."' || r.table_name || '" CASCADE';
          END LOOP;
        END $$;
        `;
        await client.query(cleanPublicSql);
        console.log('✅ Public schema cleaned.');

        // 3. Re-initialize control plane
        console.log('🏗️ Re-initializing control plane...');
        // We need to make sure sequelize is authenticated
        await sequelize.authenticate();
        await initializeControlPlaneModels();
        console.log('✅ Control plane re-initialized.');

        // 4. Final verification of public tables
        const publicTables = await client.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        `);
        console.log(`📊 Current public tables: ${publicTables.rows.map(r => r.table_name).join(', ')}`);

        console.log('✨ DATABASE RESET COMPLETE. System is now at ZERO state.');

    } catch (error) {
        console.error('❌ Reset failed:', error);
    } finally {
        await client.end();
        await sequelize.close();
    }
}

resetDatabase();
