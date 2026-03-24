#!/usr/bin/env node

/**
 * CHECK USERS TABLE SCHEMA
 */

require('dotenv').config();
const { Client } = require('pg');

async function checkUsersSchema() {
    console.log('🔍 Checking users table schema...');
    
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
        
        // Check for type column
        const result = await client.query(
            'SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2',
            ['users', 'type']
        );
        
        if (result.rows.length > 0) {
            console.log('✅ type column exists in users table');
        } else {
            console.log('❌ type column does not exist in users table');
            
            // Get all columns
            const allColumns = await client.query(
                'SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position',
                ['users']
            );
            
            console.log('Available columns in users table:');
            allColumns.rows.forEach(row => {
                console.log(`  ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
            });
        }
        
    } catch (error) {
        console.error('❌ Schema check failed:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

checkUsersSchema();
