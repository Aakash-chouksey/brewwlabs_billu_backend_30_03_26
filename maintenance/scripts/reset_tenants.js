const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URI;

async function resetTenants() {
    console.log('🔥 STARTING GLOBAL TENANT RESET...');
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    
    try {
        await client.connect();
        
        const sql = `
        DO $$ 
        DECLARE r RECORD;
        BEGIN
          FOR r IN (
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'tenant_%'
          ) LOOP
            EXECUTE 'DROP SCHEMA IF EXISTS "' || r.schema_name || '" CASCADE';
            RAISE NOTICE 'Dropped schema: %', r.schema_name;
          END LOOP;
        END $$;
        `;
        
        await client.query(sql);
        console.log('✅ ALL TENANT SCHEMAS DELETED.');
        
    } catch (e) {
        console.error('❌ Reset failed:', e);
    } finally {
        await client.end();
    }
}

resetTenants();
