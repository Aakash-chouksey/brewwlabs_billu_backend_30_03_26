/**
 * POS DATA INTEGRITY & CONSISTENCY HEALING SCRIPT
 * 
 * This script runs across all tenant schemas to:
 * 1. Normalize status casing (Available -> AVAILABLE)
 * 2. Fix orphaned orders (table_id = NULL)
 * 3. Sync Table states with Active Orders
 * 4. Ensure no tenant exists without at least one table
 */

const { sequelize } = require('../config/unified_database');
const { v4: uuidv4 } = require('uuid');

async function healDataIntegrity() {
    console.log('🚀 [HEALER] Starting POS Data Integrity & Consistency Fix...');
    
    try {
        // 1. Get all tenant schemas
        const [schemas] = await sequelize.query(
            "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'"
        );

        console.log(`🔍 [HEALER] Found ${schemas.length} tenant schemas to audit.`);

        for (const schema of schemas) {
            const schemaName = schema.schema_name;
            console.log(`\n--- 🏥 Auditing Schema: ${schemaName} ---`);

            try {
                // Check if this is a valid POS schema by checking for 'tables' table
                const [tableExists] = await sequelize.query(
                    `SELECT count(*) FROM information_schema.tables WHERE table_schema = '${schemaName}' AND table_name = 'tables'`
                );

                if (parseInt(tableExists[0].count) === 0) {
                    console.log(`⏩ Skipping ${schemaName} - No POS tables found.`);
                    continue;
                }

                // Phase 1: Status Normalization (UPPERCASE)
                console.log(`[${schemaName}] Phase 1: Normalizing status casing...`);
                await sequelize.query(`UPDATE "${schemaName}"."tables" SET status = UPPER(status)`);
                await sequelize.query(`UPDATE "${schemaName}"."orders" SET status = UPPER(status)`);
                console.log(`✅ Statuses normalized to UPPERCASE`);

                // Phase 2: Resolve Missing Tables (Ensuring every outlet has Table 1)
                console.log(`[${schemaName}] Phase 2: Resolving missing tables...`);
                const [outlets] = await sequelize.query(`SELECT id, business_id FROM "${schemaName}"."outlets"`);
                
                for (const outlet of outlets) {
                    const [tableCount] = await sequelize.query(
                        `SELECT count(*) FROM "${schemaName}"."tables" WHERE outlet_id = '${outlet.id}'`
                    );
                    
                    if (parseInt(tableCount[0].count) === 0) {
                        console.log(`⚠️  Outlet ${outlet.id} has 0 tables! Creating default...`);
                        
                        // Need an area first
                        let [area] = await sequelize.query(
                            `SELECT id FROM "${schemaName}"."table_areas" WHERE outlet_id = '${outlet.id}' LIMIT 1`
                        );
                        
                        let areaId;
                        if (area.length === 0) {
                            areaId = uuidv4();
                            await sequelize.query(
                                `INSERT INTO "${schemaName}"."table_areas" (id, business_id, outlet_id, name, status, created_at, updated_at) 
                                 VALUES ('${areaId}', '${outlet.business_id}', '${outlet.id}', 'Main Area', 'active', NOW(), NOW())`
                            );
                        } else {
                            areaId = area[0].id;
                        }

                        await sequelize.query(
                            `INSERT INTO "${schemaName}"."tables" (id, business_id, outlet_id, name, table_no, capacity, area_id, status, created_at, updated_at) 
                             VALUES ('${uuidv4()}', '${outlet.business_id}', '${outlet.id}', 'Table 1', 'T1', 4, '${areaId}', 'AVAILABLE', NOW(), NOW())`
                        );
                        console.log(`✅ Default Table 1 created for Outlet ${outlet.id}`);
                    }
                }

                // Phase 3: Fix Orphaned Orders (table_id IS NULL)
                console.log(`[${schemaName}] Phase 3: Linking orphaned orders...`);
                const [orphanedOrders] = await sequelize.query(
                    `SELECT id, outlet_id FROM "${schemaName}"."orders" WHERE table_id IS NULL`
                );

                if (orphanedOrders.length > 0) {
                    console.log(`⚠️  Found ${orphanedOrders.length} orders without table_id.`);
                    for (const order of orphanedOrders) {
                        // Get first available table for this outlet
                        const [table] = await sequelize.query(
                            `SELECT id FROM "${schemaName}"."tables" WHERE outlet_id = '${order.outlet_id}' LIMIT 1`
                        );
                        
                        if (table.length > 0) {
                            await sequelize.query(
                                `UPDATE "${schemaName}"."orders" SET table_id = '${table[0].id}' WHERE id = '${order.id}'`
                            );
                            console.log(`✅ Order ${order.id} linked to table ${table[0].id}`);
                        }
                    }
                }

                // Phase 4: Sync Table States with Active Orders
                console.log(`[${schemaName}] Phase 4: Syncing table states...`);
                // First, reset all tables to AVAILABLE
                await sequelize.query(`UPDATE "${schemaName}"."tables" SET status = 'AVAILABLE', current_order_id = NULL`);
                
                // Then find active orders and mark corresponding tables as OCCUPIED
                const [activeOrders] = await sequelize.query(
                    `SELECT id, table_id FROM "${schemaName}"."orders" WHERE status IN ('CREATED', 'KOT_SENT', 'IN_PROGRESS', 'READY', 'SERVED')`
                );

                for (const order of activeOrders) {
                    if (order.table_id) {
                        await sequelize.query(
                            `UPDATE "${schemaName}"."tables" SET status = 'OCCUPIED', current_order_id = '${order.id}' WHERE id = '${order.table_id}'`
                        );
                    }
                }
                console.log(`✅ Occupancy synced for ${activeOrders.length} active orders.`);
            } catch (schemaError) {
                console.error(`🚨 [HEALER] Error in schema ${schemaName}:`, schemaError.message);
            }
        }

        console.log('\n🎉 [HEALER] POS Data Integrity Healing Complete!');
        process.exit(0);

    } catch (error) {
        console.error('🚨 [HEALER] CRITICAL FAILURE:', error);
        process.exit(1);
    }
}

healDataIntegrity();
