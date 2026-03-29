#!/usr/bin/env node

/**
 * STEP 2: CONTROL PLANE VERIFICATION
 * Verifies control plane tables, migrations, and onboarding metadata
 */

const { Sequelize } = require('sequelize');
const config = require('../config/config');

const sequelize = new Sequelize(config.postgresURI, {
    dialect: 'postgres',
    logging: false
});

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

async function verifyControlPlane() {
    log('cyan', '\n╔════════════════════════════════════════════════════════════╗');
    log('cyan', '║       STEP 2: CONTROL PLANE VERIFICATION                   ║');
    log('cyan', '╚════════════════════════════════════════════════════════════╝\n');
    
    try {
        await sequelize.authenticate();
        log('green', '✅ Database connection: OK\n');
        
        // 1. Verify control plane tables
        await verifyControlPlaneTables();
        
        // 2. Check migrations status
        await verifyMigrations();
        
        // 3. Verify tenant registry
        await verifyTenantRegistry();
        
        // 4. Check business-user relationships
        await verifyBusinessUserRelationships();
        
        // 5. Verify no sync() usage
        await verifyNoSyncUsage();
        
        await sequelize.close();
        
        log('green', '\n✅ CONTROL PLANE VERIFICATION COMPLETE');
        
    } catch (error) {
        log('red', `\n❌ Control plane verification failed: ${error.message}`);
        await sequelize.close();
        process.exit(1);
    }
}

async function verifyControlPlaneTables() {
    log('blue', '🏗️  Checking Control Plane Tables...');
    
    const requiredTables = [
        { name: 'users', required: true },
        { name: 'businesses', required: true },
        { name: 'tenant_registry', required: true },
        { name: 'tenant_connections', required: true },
        { name: 'subscriptions', required: false },
        { name: 'plans', required: false },
        { name: 'audit_logs', required: false },
        { name: 'schema_versions', required: true },
        { name: 'super_admin_users', required: false },
        { name: 'system_metrics', required: false }
    ];
    
    const [tables] = await sequelize.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    
    const foundTables = tables.map(t => t.table_name);
    
    let allPresent = true;
    for (const { name, required } of requiredTables) {
        const exists = foundTables.includes(name);
        const status = exists ? '✅' : (required ? '❌' : '⚠️');
        const color = exists ? 'green' : (required ? 'red' : 'yellow');
        log(color, `  ${status} ${name}${exists ? '' : (required ? ' (REQUIRED)' : ' (optional)')}`);
        if (required && !exists) allPresent = false;
    }
    
    if (allPresent) {
        log('green', '\n  ✅ All required control plane tables present');
    } else {
        log('red', '\n  ❌ Missing required tables');
    }
}

async function verifyMigrations() {
    log('blue', '\n📊 Checking Migrations...');
    
    try {
        const [versions] = await sequelize.query(`
            SELECT version, migration_name, applied_at, checksum
            FROM schema_versions
            ORDER BY applied_at ASC
        `);
        
        log('blue', `  Applied migrations: ${versions.length}`);
        versions.forEach(v => {
            log('blue', `    v${v.version} - ${v.migration_name || 'N/A'} - ${new Date(v.applied_at).toISOString().split('T')[0]}`);
        });
        
        // Check for pending
        const fs = require('fs');
        const migrationFiles = fs.readdirSync('./migrations/tenant')
            .filter(f => f.match(/^v\d+.*\.js$/))
            .map(f => parseInt(f.match(/v(\d+)/)[1]));
        
        const appliedVersions = versions.map(v => parseInt(v.version));
        const pending = migrationFiles.filter(v => !appliedVersions.includes(v));
        
        if (pending.length > 0) {
            log('yellow', `  ⚠️  Pending migrations: v${pending.join(', v')} (tenant-only, will apply on onboarding)`);
        } else {
            log('green', '  ✅ All migrations up to date');
        }
        
    } catch (error) {
        log('red', `  ❌ Error checking migrations: ${error.message}`);
    }
}

async function verifyTenantRegistry() {
    log('blue', '\n🏠 Checking Tenant Registry...');
    
    try {
        const [tenants] = await sequelize.query(`
            SELECT schema_name, status, business_id, created_at
            FROM tenant_registry
            ORDER BY created_at DESC
        `);
        
        log('blue', `  Registered tenants: ${tenants.length}`);
        
        if (tenants.length === 0) {
            log('yellow', '  ⚠️  No tenants registered yet');
        } else {
            tenants.slice(0, 5).forEach(t => {
                log('blue', `    - ${t.schema_name} (${t.status})`);
            });
            
            // Check for inconsistencies
            const [orphanTenants] = await sequelize.query(`
                SELECT tr.schema_name
                FROM tenant_registry tr
                LEFT JOIN businesses b ON tr.business_id = b.id
                WHERE b.id IS NULL
            `);
            
            if (orphanTenants.length > 0) {
                log('red', `  ❌ Orphan tenants found: ${orphanTenants.length}`);
            } else {
                log('green', '  ✅ All tenants have valid business references');
            }
        }
        
    } catch (error) {
        log('red', `  ❌ Error checking tenant registry: ${error.message}`);
    }
}

async function verifyBusinessUserRelationships() {
    log('blue', '\n👥 Checking Business-User Relationships...');
    
    try {
        const [stats] = await sequelize.query(`
            SELECT 
                (SELECT COUNT(*) FROM businesses) as business_count,
                (SELECT COUNT(*) FROM users) as user_count,
                (SELECT COUNT(*) FROM users WHERE business_id IS NOT NULL) as users_with_business
        `);
        
        const s = stats[0];
        log('blue', `  Businesses: ${s.business_count}`);
        log('blue', `  Users: ${s.user_count}`);
        log('blue', `  Users with business: ${s.users_with_business}`);
        
        // Check for orphaned users
        const [orphanUsers] = await sequelize.query(`
            SELECT u.id, u.email
            FROM users u
            LEFT JOIN businesses b ON u.business_id = b.id
            WHERE u.business_id IS NOT NULL AND b.id IS NULL
        `);
        
        if (orphanUsers.length > 0) {
            log('red', `  ❌ Orphan users found: ${orphanUsers.length}`);
        } else {
            log('green', '  ✅ No orphaned users');
        }
        
    } catch (error) {
        log('red', `  ❌ Error checking relationships: ${error.message}`);
    }
}

async function verifyNoSyncUsage() {
    log('blue', '\n🔍 Checking for sync() usage (Data-First Compliance)...');
    
    const fs = require('fs');
    const path = require('path');
    
    function searchSync(dir, pattern) {
        const results = [];
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('.git')) {
                results.push(...searchSync(fullPath, pattern));
            } else if (file.endsWith('.js')) {
                const content = fs.readFileSync(fullPath, 'utf8');
                if (pattern.test(content)) {
                    const matches = content.match(pattern);
                    results.push({ file: fullPath, count: matches.length });
                }
            }
        }
        
        return results;
    }
    
    const syncPattern = /\.sync\(\s*\{|sequelize\.sync/;
    const results = searchSync('./src', syncPattern);
    const scriptResults = searchSync('./scripts', syncPattern);
    
    const allResults = [...results, ...scriptResults];
    
    if (allResults.length === 0) {
        log('green', '  ✅ No sync() usage found - Data-First compliant');
    } else {
        log('yellow', `  ⚠️  Found sync() in ${allResults.length} files:`);
        allResults.forEach(r => {
            const shortPath = r.file.replace(process.cwd(), '.');
            log('yellow', `    ${shortPath} (${r.count} occurrences)`);
        });
    }
}

verifyControlPlane();
