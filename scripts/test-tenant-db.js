#!/usr/bin/env node

/**
 * TENANT DATABASE AVAILABILITY TEST
 */

require('dotenv').config();
const { Client } = require('pg');

async function testTenantDatabase() {
    console.log('🔍 Testing Tenant Database Availability...');
    
    const dbConfig = {
        user: process.env.DEFAULT_DB_USER || 'brewlabs_user',
        password: process.env.DEFAULT_DB_PASSWORD || 'securepass',
        host: process.env.DEFAULT_DB_HOST || 'localhost',
        port: parseInt(process.env.DEFAULT_DB_PORT) || 5432,
        database: process.env.DEFAULT_DB_NAME || 'brewlabs_dev'
    };
    
    console.log('🔧 Database config:', {
        ...dbConfig,
        password: '***'
    });
    
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('✅ Database connection successful');
        
        // Test basic query
        const result = await client.query('SELECT NOW() as current_time');
        console.log('✅ Basic query successful:', result.rows[0].current_time);
        
        // Check critical tables
        const tables = ['users', 'businesses', 'outlets', 'products', 'categories', 'orders'];
        
        for (const table of tables) {
            const tableResult = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = '${table}'
                ) as exists
            `);
            
            if (tableResult.rows[0].exists) {
                console.log(`✅ Table '${table}' exists`);
                
                // Check for business_id column
                if (table === 'users' || table === 'businesses') {
                    const columnResult = await client.query(`
                        SELECT EXISTS (
                            SELECT FROM information_schema.columns 
                            WHERE table_name = '${table}' 
                            AND column_name = 'business_id'
                        ) as exists
                    `);
                    
                    if (columnResult.rows[0].exists) {
                        console.log(`✅ Column 'business_id' exists in '${table}'`);
                    } else {
                        console.log(`❌ Column 'business_id' missing in '${table}'`);
                    }
                }
            } else {
                console.log(`❌ Table '${table}' missing`);
            }
        }
        
        console.log('✅ Tenant database test completed successfully');
        
    } catch (error) {
        console.error('❌ Tenant database test failed:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

testTenantDatabase();
