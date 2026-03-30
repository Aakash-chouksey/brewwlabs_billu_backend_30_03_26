const { Client } = require("pg");
require("dotenv").config();

async function healDatabase() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    try {
        const schemasRes = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'");
        const schemas = schemasRes.rows.map(r => r.schema_name);
        console.log(`🚀 Found ${schemas.length} tenant schemas to heal.`);

        for (const schema of schemas) {
            console.log(`\n--- Healing Schema: ${schema} ---`);
            
            try {
                // 1. Fix Table Status Case (Available -> AVAILABLE)
                const tableFix = await client.query(`
                    UPDATE "${schema}".tables 
                    SET status = 'AVAILABLE' 
                    WHERE status ILIKE 'available'
                `);
                console.log(`✅ Fixed ${tableFix.rowCount} tables (Available -> AVAILABLE)`);

                // 2. Fix Order Status (CREATED -> KOT_SENT)
                const orderFix = await client.query(`
                    UPDATE "${schema}".orders 
                    SET status = 'KOT_SENT' 
                    WHERE status = 'CREATED'
                `);
                console.log(`✅ Fixed ${orderFix.rowCount} orders (CREATED -> KOT_SENT)`);

                // 3. Fix Table Occupancy (If table has active order but status is AVAILABLE)
                const occupancyFix = await client.query(`
                    UPDATE "${schema}".tables t
                    SET status = 'OCCUPIED', current_order_id = o.id
                    FROM "${schema}".orders o
                    WHERE o.table_id = t.id 
                    AND o.status IN ('KOT_SENT', 'IN_PROGRESS', 'READY')
                    AND t.status = 'AVAILABLE'
                `);
                console.log(`✅ Fixed ${occupancyFix.rowCount} tables (Syncing occupancy with active orders)`);

            } catch (err) {
                console.log(`⚠️ Skipping ${schema}: ${err.message}`);
            }
        }

        console.log("\n✨ Database healing complete!");
    } finally {
        await client.end();
    }
}

healDatabase().catch(console.error);
