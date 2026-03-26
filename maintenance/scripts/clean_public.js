const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URI;

async function cleanPublic() {
    console.log('🔥 CLEANING CONTROL PLANE (PUBLIC)...');
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    
    try {
        await client.connect();
        
        const sql = `
        DROP TABLE IF EXISTS 
        users,
        businesses,
        tenant_registry,
        audit_logs,
        subscriptions,
        plans,
        cluster_metadata,
        tenant_connections,
        tenant_migration_logs,
        super_admin_users,
        system_metrics
        CASCADE;
        `;
        
        await client.query(sql);
        console.log('✅ CONTROL PLANE TABLES DELETED.');
        
    } catch (e) {
        console.error('❌ Cleanup failed:', e);
    } finally {
        await client.end();
    }
}

cleanPublic();
