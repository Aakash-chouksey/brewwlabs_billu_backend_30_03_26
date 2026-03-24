/**
 * Apply Generated Schema Fixes to All Databases
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');
const { controlPlaneSequelize, TenantConnection } = require('../control_plane_models');
const { getTenantSequelize } = require('../src/db/tenantConnectionFactory');
const fs = require('fs');
const path = require('path');

const SQL_FILE = path.join(__dirname, 'generated_schema_fixes.sql');

async function applyFixes() {
    console.log('🚀 Applying Schema Fixes...');

    if (!fs.existsSync(SQL_FILE)) {
        console.error('❌ SQL file not found:', SQL_FILE);
        process.exit(1);
    }

    const fullSql = fs.readFileSync(SQL_FILE, 'utf8');
    
    // Split SQL into parts if needed, but our script is idempotent.
    // However, some commands might fail if they are tenant-specific or CP-specific.
    // Let's split CP and Tenant sections.
    const cpSection = fullSql.split('-- [TENANTS]')[0];
    const tenantSection = fullSql.split('-- [TENANTS]')[1];

    try {
        // 1. Apply to Control Plane
        if (!process.argv[2]) {
            console.log('\n--- Applying to Control Plane ---');
            const controlPlaneCommands = cpSection.split(';').map(c => c.trim()).filter(c => c && !c.startsWith('--'));
            for (const cmd of controlPlaneCommands) {
                try {
                    await controlPlaneSequelize.query(cmd);
                    console.log(`  ✅ ${cmd.substring(0, 30)}...`);
                } catch (err) {
                    console.error(`  ❌ Failed: ${cmd.substring(0, 30)}...: ${err.message}`);
                }
            }
        }

        // 2. Apply to Tenants
        const brandIdFilter = process.argv[2];
        const where = brandIdFilter ? { brand_id: brandIdFilter } : {};
        const connections = await TenantConnection.findAll({ where });
        const tenantCommands = tenantSection.split(';').map(c => c.trim()).filter(c => c && !c.startsWith('--'));

        for (const conn of connections) {
            console.log(`\n--- Applying to Tenant: ${conn.db_name} (Brand: ${conn.brand_id}) ---`);
            let tenantSequelize;
            try {
                tenantSequelize = await getTenantSequelize(conn);
                console.log('✅ Connection established');
                
                for (const cmd of tenantCommands) {
                    try {
                        await tenantSequelize.query(cmd);
                        console.log(`  ✅ ${cmd.substring(0, 40)}...`);
                    } catch (err) {
                        if (err.message.includes('already exists')) {
                            console.log(`  ℹ️ Skipping: ${cmd.substring(0, 40)}... (Already exists)`);
                        } else {
                            console.warn(`  ⚠️ Warning: ${cmd.substring(0, 40)}...: ${err.message}`);
                        }
                    }
                }
                await tenantSequelize.close();
                console.log(`🏁 Finished applying to ${conn.db_name}`);
            } catch (err) {
                console.error(`❌ Failed for tenant ${conn.db_name}: ${err.message}`);
            }
        }

        console.log('\n✨ All schema fixes applied!');

    } catch (error) {
        console.error('❌ Failed to apply fixes:', error);
    }
}

applyFixes();
