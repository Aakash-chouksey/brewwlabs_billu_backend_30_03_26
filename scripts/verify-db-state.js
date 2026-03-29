#!/usr/bin/env node
/**
 * POST-RESET VERIFICATION SCRIPT
 * 
 * Verifies system state after database reset and startup:
 * 1. Public schema tables
 * 2. Tenant registry structure
 * 3. Model-Database consistency
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URI;
const isCloudDb = databaseUrl.includes('neon.tech') || databaseUrl.includes('aws') || databaseUrl.includes('rds');
const sslConfig = isCloudDb ? { require: true, rejectUnauthorized: false } : false;

let processedUrl = databaseUrl;
if (isCloudDb && !processedUrl.includes('sslmode=')) {
    processedUrl += processedUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
}

const sequelize = new Sequelize(processedUrl, {
    dialect: 'postgres',
    dialectOptions: { ...(isCloudDb && { ssl: sslConfig }) },
    logging: false
});

const REQUIRED_PUBLIC_TABLES = [
    'businesses',
    'users',
    'tenant_registry'
];

const REQUIRED_TENANT_REGISTRY_COLUMNS = [
    'id',
    'business_id',
    'schema_name',
    'status',
    'retry_count',
    'last_error',
    'activated_at',
    'created_at'
];

async function verifyDatabaseState() {
    console.log('🔍 POST-RESET DATABASE VERIFICATION\n');
    
    try {
        await sequelize.authenticate();
        
        // Check 1: Public schema tables
        console.log('1️⃣ Checking public schema tables...');
        const [tables] = await sequelize.query(
            `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
        );
        
        const tableNames = tables.map(t => t.table_name);
        console.log(`   Found tables: ${tableNames.join(', ') || '(none)'}`);
        
        const missingTables = REQUIRED_PUBLIC_TABLES.filter(t => !tableNames.includes(t));
        if (missingTables.length > 0) {
            console.error(`   ❌ MISSING TABLES: ${missingTables.join(', ')}`);
        } else {
            console.log('   ✅ All required public tables exist');
        }

        // Check 2: Tenant registry columns
        if (tableNames.includes('tenant_registry')) {
            console.log('\n2️⃣ Checking tenant_registry columns...');
            const [columns] = await sequelize.query(
                `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_registry'`
            );
            
            const columnNames = columns.map(c => c.column_name);
            console.log(`   Found columns: ${columnNames.join(', ')}`);
            
            const missingColumns = REQUIRED_TENANT_REGISTRY_COLUMNS.filter(c => !columnNames.includes(c));
            if (missingColumns.length > 0) {
                console.error(`   ❌ MISSING COLUMNS: ${missingColumns.join(', ')}`);
            } else {
                console.log('   ✅ All required columns exist');
            }
        }

        // Check 3: Verify no tenant tables in public
        console.log('\n3️⃣ Checking for misplaced tenant tables in public schema...');
        const TENANT_TABLE_PATTERNS = ['products', 'orders', 'categories', 'customers', 'inventory'];
        const misplacedTables = tableNames.filter(t => 
            TENANT_TABLE_PATTERNS.some(pattern => t.toLowerCase().includes(pattern.toLowerCase()))
        );
        
        if (misplacedTables.length > 0) {
            console.warn(`   ⚠️ POSSIBLE MISPLACED TABLES: ${misplacedTables.join(', ')}`);
        } else {
            console.log('   ✅ No tenant tables in public schema');
        }

        // Check 4: List all schemas
        console.log('\n4️⃣ Listing all schemas...');
        const [schemas] = await sequelize.query(
            `SELECT schema_name FROM information_schema.schemata 
             WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
             ORDER BY schema_name`
        );
        console.log(`   Schemas: ${schemas.map(s => s.schema_name).join(', ')}`);

        console.log('\n✅ VERIFICATION COMPLETE\n');
        
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
    } finally {
        await sequelize.close();
    }
}

verifyDatabaseState();
