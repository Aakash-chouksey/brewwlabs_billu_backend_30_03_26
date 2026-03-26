const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URI;

async function runMigration() {
    const sql = fs.readFileSync(path.join(__dirname, 'migrations/999_ensure_system_consistency.sql'), 'utf8');
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    
    try {
        await client.connect();
        
        // 1. Run on PUBLIC
        console.log('📦 Applying migration to PUBLIC schema...');
        await client.query('SET search_path TO public');
        await client.query(sql);
        
        // 2. Run on all TENANT schemas
        const res = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'");
        for (const row of res.rows) {
            console.log(`📦 Applying migration to ${row.schema_name}...`);
            await client.query(`SET search_path TO "${row.schema_name}"`);
            await client.query(sql);
        }
        
        console.log('✅ Migration completed successfully!');
    } catch (e) {
        console.error('❌ Migration failed:', e);
    } finally {
        await client.end();
    }
}

runMigration();
