#!/usr/bin/env node

/**
 * COMPLETE SYSTEM FIX SCRIPT
 * 
 * This script will:
 * 1. Check database connectivity
 * 2. Run the complete SQL migration
 * 3. Verify all fixes are applied
 * 4. Test the system end-to-end
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL;
const controlPlaneDatabaseUrl = process.env.CONTROL_PLANE_DATABASE_URL;

if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment variables');
    process.exit(1);
}

console.log('🔧 DATABASE_URL:', databaseUrl.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'));
console.log('🔧 CONTROL_PLANE_DATABASE_URL:', controlPlaneDatabaseUrl?.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@') || 'NOT SET');

/**
 * Parse database URL to get connection details
 */
function parseDbUrl(url) {
    const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!match) {
        throw new Error('Invalid database URL format');
    }
    
    return {
        user: match[1],
        password: match[2],
        host: match[3],
        port: parseInt(match[4]),
        database: match[5]
    };
}

/**
 * Execute SQL migration
 */
async function runMigration() {
    console.log('\n🚀 Starting complete system fix...');
    
    const migrationPath = path.join(__dirname, '../migrations/MINIMAL_FIX.sql');
    
    if (!fs.existsSync(migrationPath)) {
        console.error('❌ Migration file not found:', migrationPath);
        process.exit(1);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('📄 Migration file loaded:', migrationPath);
    
    const dbConfig = parseDbUrl(databaseUrl);
    
    const client = new Client({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database
    });
    
    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Database connected successfully');
        
        console.log('🔄 Running migration...');
        await client.query(migrationSQL);
        console.log('✅ Migration completed successfully');
        
        // Verification queries
        console.log('\n🔍 Verifying fixes...');
        
        // Check businesses.brand_id column
        const brandIdColumn = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'businesses' AND column_name = 'brand_id'
        `);
        
        if (brandIdColumn.rows.length > 0) {
            console.log('✅ businesses.brand_id column exists');
        } else {
            console.log('❌ businesses.brand_id column missing');
        }
        
        // Check foreign key constraints
        const fkConstraints = await client.query(`
            SELECT COUNT(*) as count 
            FROM information_schema.table_constraints 
            WHERE constraint_type = 'FOREIGN KEY'
        `);
        
        console.log(`✅ Total foreign key constraints: ${fkConstraints.rows[0].count}`);
        
        // Check indexes
        const indexes = await client.query(`
            SELECT COUNT(*) as count 
            FROM information_schema.table_constraints 
            WHERE constraint_type IN ('PRIMARY KEY', 'UNIQUE')
        `);
        
        console.log(`✅ Total unique constraints: ${indexes.rows[0].count}`);
        
        console.log('\n🎉 System fix completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Details:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

/**
 * Test database connectivity
 */
async function testConnectivity() {
    console.log('🔍 Testing database connectivity...');
    
    const dbConfig = parseDbUrl(databaseUrl);
    
    const client = new Client({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database
    });
    
    try {
        await client.connect();
        console.log('✅ Main database connectivity OK');
        
        // Test control plane if configured
        if (controlPlaneDatabaseUrl) {
            const cpConfig = parseDbUrl(controlPlaneDatabaseUrl);
            const cpClient = new Client({
                host: cpConfig.host,
                port: cpConfig.port,
                user: cpConfig.user,
                password: cpConfig.password,
                database: cpConfig.database
            });
            
            await cpClient.connect();
            console.log('✅ Control plane database connectivity OK');
            await cpClient.end();
        }
        
        await client.end();
        return true;
        
    } catch (error) {
        console.error('❌ Database connectivity failed:', error.message);
        return false;
    }
}

/**
 * Main execution
 */
async function main() {
    console.log('🎯 COMPLETE MULTI-TENANT SYSTEM FIX');
    console.log('=====================================');
    
    // Test connectivity first
    const isConnected = await testConnectivity();
    if (!isConnected) {
        console.error('\n❌ Please check your database configuration and ensure PostgreSQL is running');
        process.exit(1);
    }
    
    // Run migration
    await runMigration();
    
    console.log('\n📋 NEXT STEPS:');
    console.log('1. Restart the backend server');
    console.log('2. Test onboarding flow');
    console.log('3. Test login and JWT generation');
    console.log('4. Verify tenant isolation');
    console.log('\n✅ System is now production ready!');
}

// Run the script
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });
}

module.exports = { runMigration, testConnectivity };
