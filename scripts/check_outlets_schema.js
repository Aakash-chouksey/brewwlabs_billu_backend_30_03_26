#!/usr/bin/env node

/**
 * CHECK OUTLETS TABLE SCHEMA
 */

require('dotenv').config();
const { Client } = require('pg');

async function checkOutletsSchema() {
    console.log('🔍 Checking outlets table schema...');
    
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
            ['outlets', 'type']
        );
        
        if (result.rows.length > 0) {
            console.log('✅ type column exists in outlets table');
        } else {
            console.log('❌ type column does not exist in outlets table');
            
            // Get all columns
            const allColumns = await client.query(
                'SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position',
                ['outlets']
            );
            
            console.log('Available columns in outlets table:');
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

checkOutletsSchema();
