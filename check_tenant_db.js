const { Client } = require('pg');
require('dotenv').config();

async function checkTenantDB() {
    console.log('Checking tenant database connections...');
    
    // First, check control plane to find tenant connections
    const controlClient = new Client({
        user: 'brewlabs_user',
        password: 'securepass',
        host: 'localhost',
        port: 5432,
        database: 'brewlabs_dev'
    });
    
    try {
        await controlClient.connect();
        console.log('✅ Connected to control plane database');
        
        // Find all tenant connections
        const result = await controlClient.query(`
            SELECT id, business_id, db_name, db_host, db_port, db_user, status
            FROM tenant_connections
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        console.log(`\n📊 Found ${result.rows.length} tenant connections:`);
        result.rows.forEach(row => {
            console.log(`  - ${row.db_name} (Business: ${row.business_id}, Status: ${row.status})`);
        });
        
        if (result.rows.length > 0) {
            // Test connection to the latest tenant database
            const latestTenant = result.rows[0];
            console.log(`\n🔍 Testing connection to tenant: ${latestTenant.db_name}`);
            
            // Try to connect to the tenant database directly
            const tenantClient = new Client({
                user: 'brewlabs_user',
                password: 'securepass',
                host: 'localhost',
                port: 5432,
                database: latestTenant.db_name
            });
            
            try {
                await tenantClient.connect();
                console.log('✅ Successfully connected to tenant database');
                
                // Check if orders table exists
                const tables = await tenantClient.query(`
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                    ORDER BY table_name
                `);
                
                console.log(`\n📋 Tables in tenant database (${tables.rows.length}):`);
                tables.rows.forEach(row => {
                    console.log(`  - ${row.table_name}`);
                });
                
                await tenantClient.end();
            } catch (err) {
                console.error('❌ Failed to connect to tenant database:', err.message);
                
                // Try to create the tenant database
                console.log('\n🔧 Attempting to create tenant database...');
                await controlClient.query(`CREATE DATABASE ${latestTenant.db_name}`);
                console.log('✅ Tenant database created');
            }
        }
        
    } catch (err) {
        console.error('❌ Error checking tenant database:', err.message);
    } finally {
        await controlClient.end();
    }
}

checkTenantDB().catch(console.error);
