require('dotenv').config();
const { Sequelize } = require('sequelize');
const { TenantConnection } = require('../control_plane_models');
const { getTenantSequelize } = require('../src/db/tenantConnectionFactory');

async function check() {
    console.log('🔍 Verifying tenant_coffee_empire schema...');
    const conn = await TenantConnection.findOne({ where: { db_name: 'tenant_coffee_empire' } });
    if (!conn) { console.error('❌ Tenant not found in control plane'); return; }
    
    const s = await getTenantSequelize(conn);
    const [results] = await s.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
    console.log('✅ Columns in users:', results.map(r => r.column_name).sort());

    const [catCols] = await s.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'categories'");
    console.log('✅ Columns in categories:', catCols.map(r => r.column_name).sort());

    const [prodCols] = await s.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'products'");
    console.log('✅ Columns in products:', prodCols.map(r => r.column_name).sort());
    
    const [inv] = await s.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'inventory'");
    console.log('✅ Inventory table exists:', inv.length > 0);
    
    if (inv.length > 0) {
        const [invCols] = await s.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'inventory'");
        console.log('✅ Columns in inventory:', invCols.map(r => r.column_name).sort());
    }
    
    await s.close();
}
check().catch(err => console.error('❌ Verification failed:', err.message));
