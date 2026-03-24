require('dotenv').config();
const { Sequelize } = require('sequelize');
const { TenantConnection } = require('../control_plane_models');
const { getTenantSequelize } = require('../src/db/tenantConnectionFactory');

async function check(brandId) {
    const conn = await TenantConnection.findOne({ where: { brand_id: brandId } });
    if (!conn) { console.error(`❌ Tenant ${brandId} not found`); return; }
    
    console.log(`\n🔍 Verifying ${conn.db_name} (${brandId})...`);
    const s = await getTenantSequelize(conn);
    const [results] = await s.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'categories'");
    const cols = results.map(r => r.column_name);
    console.log('✅ Categories columns:', cols.includes('business_id') ? 'business_id PRESENT' : 'business_id MISSING');
    
    await s.close();
}

async function run() {
    await check('65d6d8fc-3322-49df-b424-366f89db7ae4');
    await check('e6b90030-c412-47a5-a633-a18e5a2796e8');
    await check('95b1e97d-68d0-4947-bd84-25f402bb6b92');
}

run().catch(err => console.error(err));
