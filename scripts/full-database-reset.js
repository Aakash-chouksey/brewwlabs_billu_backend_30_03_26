#!/usr/bin/env node
/**
 * FULL DATABASE RESET - Simulate Fresh Production Environment
 * 
 * This script:
 * 1. Drops all tenant schemas
 * 2. Drops and recreates public schema
 * 3. Verifies clean state
 * 
 * ⚠️ WARNING: This will DELETE ALL DATA
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URI;

if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is required!');
    process.exit(1);
}

// Detect if using cloud database
const isCloudDb = databaseUrl.includes('neon.tech') || 
                  databaseUrl.includes('aws') || 
                  databaseUrl.includes('rds');

// SSL config only for cloud databases
const sslConfig = isCloudDb ? {
    require: true,
    rejectUnauthorized: false
} : false;

let processedUrl = databaseUrl;
if (isCloudDb && !processedUrl.includes('sslmode=')) {
    processedUrl += processedUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
}

const sequelize = new Sequelize(processedUrl, {
    dialect: 'postgres',
    dialectOptions: {
        ...(isCloudDb && { ssl: sslConfig }),
        connectTimeout: isCloudDb ? 60000 : 10000,
    },
    pool: {
        max: 5,
        min: 0,
        acquire: isCloudDb ? 120000 : 30000,
    },
    logging: false
});

async function resetDatabase() {
    console.log('🔥 STARTING FULL DATABASE RESET...');
    console.log(`🔗 Database: ${isCloudDb ? 'Cloud' : 'Local'}`);
    
    try {
        await sequelize.authenticate();
        console.log('✅ Database connection established');

        // Step 1: Get all schemas (except system schemas)
        console.log('\n📋 Step 1: Discovering existing schemas...');
        const [schemas] = await sequelize.query(
            `SELECT schema_name 
             FROM information_schema.schemata 
             WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1')
             ORDER BY schema_name`
        );

        console.log(`   Found ${schemas.length} schemas:`);
        schemas.forEach(s => console.log(`   - ${s.schema_name}`));

        // Step 2: Drop all tenant schemas first (schemas starting with 'tenant_')
        console.log('\n🔥 Step 2: Dropping tenant schemas...');
        const tenantSchemas = schemas.filter(s => s.schema_name.startsWith('tenant_'));
        
        for (const { schema_name } of tenantSchemas) {
            try {
                await sequelize.query(`DROP SCHEMA IF EXISTS "${schema_name}" CASCADE`);
                console.log(`   ✅ Dropped: ${schema_name}`);
            } catch (error) {
                console.error(`   ❌ Failed to drop ${schema_name}:`, error.message);
            }
        }

        // Step 3: Drop and recreate public schema
        console.log('\n🔥 Step 3: Resetting public schema...');
        try {
            await sequelize.query('DROP SCHEMA IF EXISTS public CASCADE');
            console.log('   ✅ Dropped public schema');
        } catch (error) {
            console.error('   ❌ Failed to drop public schema:', error.message);
        }

        try {
            await sequelize.query('CREATE SCHEMA public');
            console.log('   ✅ Created public schema');
        } catch (error) {
            console.error('   ❌ Failed to create public schema:', error.message);
            throw error;
        }

        // Grant permissions on public schema
        try {
            await sequelize.query('GRANT ALL ON SCHEMA public TO public');
            await sequelize.query('GRANT ALL ON SCHEMA public TO CURRENT_USER');
            console.log('   ✅ Granted permissions on public schema');
        } catch (error) {
            console.warn('   ⚠️ Could not grant permissions:', error.message);
        }

        // Step 4: Verify clean state
        console.log('\n✅ Step 4: Verifying clean state...');
        const [remainingSchemas] = await sequelize.query(
            `SELECT schema_name 
             FROM information_schema.schemata 
             WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1')
             ORDER BY schema_name`
        );

        if (remainingSchemas.length === 1 && remainingSchemas[0].schema_name === 'public') {
            console.log('   ✅ Database is clean - only public schema exists');
        } else {
            console.warn('   ⚠️ Unexpected schemas found:', remainingSchemas.map(s => s.schema_name));
        }

        // Step 5: Verify public schema is empty
        const [tables] = await sequelize.query(
            `SELECT table_name 
             FROM information_schema.tables 
             WHERE table_schema = 'public'`
        );

        if (tables.length === 0) {
            console.log('   ✅ Public schema is empty (no tables)');
        } else {
            console.warn('   ⚠️ Tables found in public schema:', tables.map(t => t.table_name));
        }

        console.log('\n🎉 DATABASE RESET COMPLETE!');
        console.log('   System is ready for fresh initialization');
        console.log('   Run: npm start');
        
    } catch (error) {
        console.error('\n❌ Database reset failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

// Run reset
resetDatabase();
