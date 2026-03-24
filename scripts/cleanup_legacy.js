require('dotenv').config();
const { getTenantSequelize } = require('../src/db/tenantConnectionFactory');
const { TenantConnection } = require('../control_plane_models');

async function cleanup() {
    console.log('🧹 Cleaning up legacy columns...');
    const brandIdFilter = process.argv[2];
    const where = brandIdFilter ? { brand_id: brandIdFilter } : {};
    const connections = await TenantConnection.findAll({ where });
    
    for (const conn of connections) {
        console.log(`\n--- Cleaning ${conn.db_name} ---`);
        const s = await getTenantSequelize(conn);
        
        try {
            // Define tables and their potential legacy columns to fix
            const fixes = [
                { table: 'users', legacy: ['businessid', 'isactive', 'tokenversion', 'lastlogin'] },
                { table: 'categories', legacy: ['businessid', 'isenabled', 'sortorder', 'outletid'] },
                { table: 'products', legacy: ['businessid', 'outletid', 'categoryid', 'isavailable', 'trackstock', 'minstocklevel', 'maxstocklevel', 'taxrate', 'producttype'], types: [{ col: 'track_stock', type: 'BOOLEAN', using: 'track_stock::BOOLEAN' }] },
                { table: 'inventory', legacy: ['businessid', 'outletid', 'productid'] },
                { table: 'tables', legacy: ['businessid', 'outletid', 'areaid'] },
                { table: 'orders', legacy: ['businessid', 'outletid', 'waiterid'] }
            ];
            
            for (const fix of fixes) {
                // Check if table exists
                const [exists] = await s.query(`SELECT table_name FROM information_schema.tables WHERE table_name = '${fix.table}'`);
                if (exists.length === 0) continue;

                for (const col of fix.legacy) {
                    try {
                        // Check if column exists
                        const [colExists] = await s.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${fix.table}' AND column_name = '${col}'`);
                        if (colExists.length > 0) {
                            console.log(`  🔧 Making ${fix.table}.${col} nullable...`);
                            await s.query(`ALTER TABLE ${fix.table} ALTER COLUMN ${col} DROP NOT NULL`);
                        }
                    } catch (e) {
                        console.log(`  ⚠️ Failed to fix ${fix.table}.${col}: ${e.message}`);
                    }
                }

                // Apply type fixes
                if (fix.types) {
                    for (const typeFix of fix.types) {
                        try {
                            const [colInfo] = await s.query(`SELECT data_type FROM information_schema.columns WHERE table_name = '${fix.table}' AND column_name = '${typeFix.col}'`);
                            if (colInfo.length > 0 && colInfo[0].data_type.toUpperCase() !== typeFix.type.split('(')[0].toUpperCase()) {
                                console.log(`  🔧 Repairing type for ${fix.table}.${typeFix.col} to ${typeFix.type}...`);
                                if (typeFix.col === 'track_stock') {
                                    await s.query(`ALTER TABLE ${fix.table} DROP COLUMN IF EXISTS ${typeFix.col}`);
                                    await s.query(`ALTER TABLE ${fix.table} ADD COLUMN ${typeFix.col} BOOLEAN DEFAULT FALSE`);
                                } else {
                                    await s.query(`ALTER TABLE ${fix.table} ALTER COLUMN ${typeFix.col} TYPE ${typeFix.type} ${typeFix.using ? 'USING ' + typeFix.using : ''}`);
                                }
                            }
                        } catch (e) {
                            console.log(`  ⚠️ Failed to repair type for ${fix.table}.${typeFix.col}: ${e.message}`);
                        }
                    }
                }
            }
            console.log(`✅ ${conn.db_name} cleaned up.`);
        } catch (err) {
            console.error(`❌ Global error for ${conn.db_name}:`, err.message);
        } finally {
            await s.close();
        }
    }
}

cleanup().catch(err => console.error(err));
