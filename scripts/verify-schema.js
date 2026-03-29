#!/usr/bin/env node

/**
 * STEP 1: SCHEMA VERIFICATION SCRIPT
 * Comprehensive schema validation for multi-tenant SaaS
 */

const { Sequelize } = require('sequelize');
const config = require('../config/config');

// Create sequelize connection
const sequelize = new Sequelize(config.postgresURI, {
    dialect: 'postgres',
    logging: false,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
});

// ANSI colors
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(level, msg) {
    const c = colors[level] || colors.reset;
    console.log(`${c}${msg}${colors.reset}`);
}

async function verifySchema() {
    log('cyan', '\n╔════════════════════════════════════════════════════════════╗');
    log('cyan', '║         STEP 1: SCHEMA VERIFICATION (FOUNDATION)         ║');
    log('cyan', '╚════════════════════════════════════════════════════════════╝\n');
    
    try {
        await sequelize.authenticate();
        log('green', '✅ Database connection: OK');
        
        // Get all schemas
        const [schemas] = await sequelize.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
            ORDER BY schema_name
        `);
        
        log('blue', `\n📊 Found ${schemas.length} schemas:`);
        schemas.forEach(s => log('blue', `  - ${s.schema_name}`));
        
        // Focus on public schema first
        await verifyPublicSchema();
        
        // Verify tenant schemas
        const tenantSchemas = schemas.filter(s => s.schema_name.startsWith('tenant_'));
        if (tenantSchemas.length > 0) {
            log('blue', `\n🏢 Verifying ${tenantSchemas.length} tenant schemas...`);
            for (const { schema_name } of tenantSchemas.slice(0, 3)) { // Check first 3
                await verifyTenantSchema(schema_name);
            }
        }
        
        // Check schema_versions consistency
        await verifySchemaVersions();
        
        await sequelize.close();
        
        log('green', '\n✅ SCHEMA VERIFICATION COMPLETE');
        
    } catch (error) {
        log('red', `\n❌ Schema verification failed: ${error.message}`);
        await sequelize.close();
        process.exit(1);
    }
}

async function verifyPublicSchema() {
    log('blue', '\n🏗️  Checking PUBLIC schema (control plane)...');
    
    const [tables] = await sequelize.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    `);
    
    const requiredTables = [
        'users', 'businesses', 'outlets', 'tenant_registry', 
        'tenant_connections', 'subscriptions', 'plans',
        'audit_logs', 'schema_versions', 'super_admin_users'
    ];
    
    const foundTables = tables.map(t => t.table_name);
    const missing = requiredTables.filter(t => !foundTables.includes(t));
    
    log('blue', `  Found ${foundTables.length} tables`);
    
    if (missing.length > 0) {
        log('yellow', `  ⚠️  Missing tables: ${missing.join(', ')}`);
    } else {
        log('green', '  ✅ All required control plane tables present');
    }
    
    // Check column details for key tables
    for (const table of ['users', 'businesses', 'tenant_registry']) {
        if (foundTables.includes(table)) {
            await verifyTableColumns('public', table);
        }
    }
}

async function verifyTenantSchema(schemaName) {
    log('blue', `\n🔍 Checking ${schemaName}...`);
    
    const [tables] = await sequelize.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = :schema AND table_type = 'BASE TABLE'
        ORDER BY table_name
    `, { replacements: { schema: schemaName } });
    
    const requiredTenantTables = [
        'users', 'products', 'categories', 'orders', 'order_items',
        'inventory_items', 'inventory_categories', 'inventory_transactions',
        'outlets', 'areas', 'tables', 'payments', 'suppliers'
    ];
    
    const foundTables = tables.map(t => t.table_name);
    const missing = requiredTenantTables.filter(t => !foundTables.includes(t));
    
    log('blue', `  Found ${foundTables.length}/${requiredTenantTables.length} required tables`);
    
    if (missing.length > 0) {
        log('yellow', `  ⚠️  Missing: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}`);
    } else {
        log('green', '  ✅ All tenant tables present');
    }
}

async function verifyTableColumns(schema, table) {
    const [columns] = await sequelize.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = :schema AND table_name = :table
        ORDER BY ordinal_position
    `, { replacements: { schema, table } });
    
    log('blue', `    ${table}: ${columns.length} columns`);
}

async function verifySchemaVersions() {
    log('blue', '\n📊 Checking schema_versions table...');
    
    try {
        const [versions] = await sequelize.query(`
            SELECT version, migration_name, applied_at
            FROM schema_versions
            ORDER BY applied_at DESC
        `);
        
        if (versions.length === 0) {
            log('yellow', '  ⚠️  No migrations recorded');
        } else {
            log('green', `  ✅ ${versions.length} migrations applied`);
            log('blue', `  Latest: v${versions[0].version} - ${versions[0].migration_name || 'N/A'}`);
        }
        
        // Check pending migrations
        const migrationFiles = require('fs').readdirSync('./migrations/tenant')
            .filter(f => f.endsWith('.js'))
            .map(f => f.match(/v(\d+)/)?.[1])
            .filter(Boolean)
            .map(Number);
        
        const appliedVersions = versions.map(v => parseInt(v.version));
        const pending = migrationFiles.filter(v => !appliedVersions.includes(v));
        
        if (pending.length > 0) {
            log('yellow', `  ⚠️  ${pending.length} pending migrations: v${pending.join(', v')}`);
        } else {
            log('green', '  ✅ All migrations up to date');
        }
        
    } catch (error) {
        log('red', `  ❌ Error: ${error.message}`);
    }
}

verifySchema();
