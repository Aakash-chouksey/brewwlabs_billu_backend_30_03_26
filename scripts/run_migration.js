#!/usr/bin/env node

/**
 * RUN MIGRATION FOR TENANT CONNECTIONS
 */

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    console.log('🔧 Running migration for tenant_connections table...');
    
    const client = new Client({
        user: 'brewlabs_user',
        password: 'securepass',
        host: 'localhost',
        port: 5432,
        database: 'brewlabs_dev'
    });
    
    try {
        await client.connect();
        console.log('✅ Connected to database');
        
        const migrationPath = path.join(process.cwd(), 'migrations/add_business_id_to_tenant_connections.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('🔄 Running migration...');
        await client.query(migrationSQL);
        console.log('✅ Migration completed successfully');
        
        // Verify the column exists
        const result = await client.query(
            'SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2',
            ['tenant_connections', 'business_id']
        );
        
        if (result.rows.length > 0) {
            console.log('✅ business_id column now exists in tenant_connections table');
        } else {
            console.log('❌ business_id column still missing');
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
