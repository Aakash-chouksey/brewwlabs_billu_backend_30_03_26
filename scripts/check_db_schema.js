#!/usr/bin/env node

/**
 * DATABASE SCHEMA CHECKER
 */

require('dotenv').config();
const { Client } = require('pg');

async function checkDatabaseSchema() {
    console.log('🔍 Checking Database Schema for business_id columns...');
    
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
        
        const tables = ['users', 'businesses', 'outlets', 'products', 'categories', 'orders', 'customers', 'inventory_items', 'inventory_categories'];
        
        for (const table of tables) {
            console.log(`\n📋 ${table} table:`);
            
            // Check if table exists
            const tableExists = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = '${table}'
                ) as exists
            `);
            
            if (!tableExists.rows[0].exists) {
                console.log('  ❌ Table does not exist');
                continue;
            }
            
            // Check for business_id and brand_id columns
            const columns = await client.query(`
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = '${table}' 
                AND column_name IN ('business_id', 'brand_id')
                ORDER BY column_name
            `);
            
            if (columns.rows.length > 0) {
                columns.rows.forEach(row => {
                    console.log(`  ✅ ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
                });
            } else {
                console.log('  ❌ No business_id or brand_id columns found');
            }
        }
        
        // Check specific business that's causing issues
        console.log('\n🔍 Checking business 7864f706-f9ed-4782-aa5e-d9ab229c877c...');
        
        const businessCheck = await client.query(`
            SELECT id, name, business_id, brand_id 
            FROM businesses 
            WHERE id = '7864f706-f9ed-4782-aa5e-d9ab229c877c'
        `);
        
        if (businessCheck.rows.length > 0) {
            const business = businessCheck.rows[0];
            console.log('✅ Business found:', {
                id: business.id,
                name: business.name,
                business_id: business.business_id,
                brand_id: business.brand_id
            });
        } else {
            console.log('❌ Business not found');
        }
        
    } catch (error) {
        console.error('❌ Database check failed:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

checkDatabaseSchema();
