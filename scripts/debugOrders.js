/**
 * Debug script to trace why orders aren't showing in Order Registry
 * Run: node scripts/debugOrders.js
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const DB_URL = process.env.DATABASE_URL || 'postgresql://dev:devpass@localhost:5432/brewwlabs';
const BUSINESS_ID = '2cda9723-2886-4d4d-9479-b4d22c875ce6'; // From logs
const OUTLET_ID = '3f3915df-9a01-495c-a7a0-58ce2759d251'; // From logs

async function debugOrders() {
  const sequelize = new Sequelize(DB_URL, { logging: false });
  
  console.log('\n🔍 ORDER DEBUG SCRIPT\n');
  console.log('Business ID:', BUSINESS_ID);
  console.log('Outlet ID:', OUTLET_ID);
  console.log('Schema: tenant_' + BUSINESS_ID);
  
  try {
    // 1. Check if orders table exists and has data
    console.log('\n📊 1. Checking orders table...');
    const [orderCounts] = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'CREATED' THEN 1 END) as created,
        COUNT(CASE WHEN status = 'KOT_SENT' THEN 1 END) as kot_sent,
        COUNT(CASE WHEN status = 'READY' THEN 1 END) as ready,
        COUNT(CASE WHEN status = 'CLOSED' THEN 1 END) as closed
      FROM "tenant_${BUSINESS_ID}".orders
    `);
    console.log('   Order counts:', orderCounts[0]);

    // 2. Check orders for specific outlet
    console.log('\n📊 2. Orders for this outlet...');
    const [outletOrders] = await sequelize.query(`
      SELECT COUNT(*) as count, MIN(created_at) as oldest, MAX(created_at) as newest
      FROM "tenant_${BUSINESS_ID}".orders
      WHERE outlet_id = '${OUTLET_ID}'
    `);
    console.log('   Outlet orders:', outletOrders[0]);

    // 3. Sample recent orders (if any)
    console.log('\n📊 3. Sample recent orders...');
    const [recentOrders] = await sequelize.query(`
      SELECT id, status, outlet_id, created_at, billing_total
      FROM "tenant_${BUSINESS_ID}".orders
      ORDER BY created_at DESC
      LIMIT 5
    `);
    console.log('   Recent orders:', recentOrders.length > 0 ? recentOrders : 'None found');

    // 4. Check date range issues (today filter)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log('\n📊 4. Today filter check...');
    console.log('   Today start (local):', today.toISOString());
    
    const [todayOrders] = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM "tenant_${BUSINESS_ID}".orders
      WHERE created_at >= '${today.toISOString()}'
    `);
    console.log('   Orders from today:', todayOrders[0].count);

    // 5. Show all outlet IDs in orders table
    console.log('\n📊 5. Outlet IDs in orders table...');
    const [outlets] = await sequelize.query(`
      SELECT DISTINCT outlet_id, COUNT(*) as order_count
      FROM "tenant_${BUSINESS_ID}".orders
      GROUP BY outlet_id
    `);
    console.log('   Outlets with orders:', outlets);

    // 6. Check if there's a mismatch between token outlet and order outlet
    if (outlets.length > 0 && !outlets.find(o => o.outlet_id === OUTLET_ID)) {
      console.log('\n⚠️  WARNING: Orders exist but NOT for this outlet!');
      console.log('   Orders are for outlet(s):', outlets.map(o => o.outlet_id).join(', '));
      console.log('   But user token has outlet:', OUTLET_ID);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await sequelize.close();
    console.log('\n✅ Debug complete\n');
  }
}

debugOrders();
