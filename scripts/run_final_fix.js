#!/usr/bin/env node

/**
 * FINAL DATABASE FIX RUNNER
 */

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runFinalFix() {
    console.log('🔧 Running Final Database Fix...');
    
    const dbConfig = {
        user: 'brewlabs_user',
        password: 'securepass',
        host: 'localhost',
        port: 5432,
        database: 'brewlabs_dev'
    };
    
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('✅ Connected to database');
        
        const migrationPath = path.join(__dirname, '../migrations/FINAL_DB_FIX.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        await client.query(migrationSQL);
        console.log('✅ Final database fix completed successfully');
        
    } catch (error) {
        console.error('❌ Final database fix failed:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runFinalFix();
