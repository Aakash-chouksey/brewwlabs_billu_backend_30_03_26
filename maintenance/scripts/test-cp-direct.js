require('dotenv').config();
const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

async function testControlPlane() {
  const client = new Client({ connectionString: process.env.CONTROL_PLANE_DATABASE_URL });
  await client.connect();
  console.log('Connected to control plane');

  const businessId = uuidv4();
  try {
    await client.query('BEGIN');
    const res = await client.query(
      `INSERT INTO businesses (id, name, email, phone, address, status, type, is_active, settings, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING id`,
      [businessId, 'Test Cafe', 'test@direct.com', '+91987654321', '123 St', 'active', 'SOLO', true, '{}']
    );
    console.log('Business created:', res.rows[0].id);

    // Create tenant connection
    const tcId = uuidv4();
    await client.query(
      `INSERT INTO tenant_connections (id, business_id, db_name, db_host, db_port, db_user, encrypted_password, status, pool_max_connections, pool_min_connections, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', 10, 2, NOW(), NOW())`,
      [tcId, businessId, 'tenant_test', 'localhost', 5432, 'test_user', 'test_pass']
    );
    console.log('Tenant connection created:', tcId);
    
    await client.query('ROLLBACK');  // Clean up
    console.log('Transaction rolled back (test complete)');
    console.log('✅ Control plane direct insert works correctly!');
  } catch (e) {
    console.error('❌ Error:', e.message);
    await client.query('ROLLBACK').catch(() => {});
  }
  await client.end();
}

testControlPlane().catch(e => { console.error(e); process.exit(1); });
