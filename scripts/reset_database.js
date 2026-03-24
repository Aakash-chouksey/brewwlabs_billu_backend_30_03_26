/**
 * 🧹 DATABASE RESET SCRIPT
 * 
 * Performs a complete wipe of tenant schemas and recreates the public control plane.
 */

const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URI;

if (!connectionString) {
    console.error('❌ DATABASE_URL is not set');
    process.exit(1);
}

async function resetDatabase() {
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('🔌 Connected to database for reset...');

        // 1. Get all tenant schemas
        const schemaRes = await client.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'tenant_%'
        `);
        const schemas = schemaRes.rows.map(r => r.schema_name);

        console.log(`🗑️  Found ${schemas.length} tenant schemas to drop...`);

        // 2. Drop tenant schemas CASCADE
        for (const schema of schemas) {
            console.log(`   - Dropping schema: ${schema}`);
            await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        }

        // 3. Nuclear Reset of public schema (drops all tables, types, etc.)
        console.log('☢️  Performing nuclear reset of public schema...');
        await client.query('DROP SCHEMA public CASCADE');
        await client.query('CREATE SCHEMA public');
        await client.query('GRANT ALL ON SCHEMA public TO public');
        await client.query(`GRANT ALL ON SCHEMA public TO "${client.user}"`);


        console.log('\n=== RESET STATUS ===');
        console.log('✅ Database cleaned');
        console.log(`✅ ${schemas.length} tenant schemas dropped`);
        console.log(`✅ Public schema reset successfully`);

    } catch (error) {
        console.error('❌ Reset failed:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

resetDatabase();
