#!/usr/bin/env node

/**
 * RUN TYPE COLUMNS MIGRATION
 */

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runTypeColumnsMigration() {
    console.log('🔧 Running migration for type columns...');
    
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
        
        const migrationPath = path.join(process.cwd(), 'migrations/add_type_columns.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('🔄 Running migration...');
        await client.query(migrationSQL);
        console.log('✅ Migration completed successfully');
        
        // Verify the columns exist
        const accountsResult = await client.query(
            'SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2',
            ['accounts', 'type']
        );
        
        const transactionsResult = await client.query(
            'SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2',
            ['transactions', 'type']
        );
        
        if (accountsResult.rows.length > 0) {
            console.log('✅ type column now exists in accounts table');
        } else {
            console.log('❌ type column still missing in accounts table');
        }
        
        if (transactionsResult.rows.length > 0) {
            console.log('✅ type column now exists in transactions table');
        } else {
            console.log('❌ type column still missing in transactions table');
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runTypeColumnsMigration();
