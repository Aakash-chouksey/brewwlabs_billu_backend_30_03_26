require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false
});

async function verifyDatabase() {
  try {
    console.log('🔍 PHASE 1: Database Verification\n');
    
    // 1. Check schemas
    console.log('📋 Schemas:');
    const schemas = await sequelize.query(
      `SELECT schema_name FROM information_schema.schemata 
       WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
       ORDER BY schema_name`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    
    schemas.forEach(s => console.log(`   - ${s.schema_name}`));
    
    // 2. Check tables in each schema
    console.log('\n📋 Tables by Schema:');
    const tables = await sequelize.query(
      `SELECT schemaname, tablename 
       FROM pg_tables 
       WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
       ORDER BY schemaname, tablename`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    
    const bySchema = {};
    tables.forEach(t => {
      if (!bySchema[t.schemaname]) bySchema[t.schemaname] = [];
      bySchema[t.schemaname].push(t.tablename);
    });
    
    Object.entries(bySchema).forEach(([schema, tabs]) => {
      console.log(`\n   ${schema} (${tabs.length} tables):`);
      tabs.forEach(t => console.log(`      - ${t}`));
    });
    
    // 3. Verify tenant schemas exist
    const tenantSchemas = schemas.filter(s => s.schema_name.startsWith('tenant_'));
    console.log(`\n✅ Found ${tenantSchemas.length} tenant schemas`);
    
    if (tenantSchemas.length === 0) {
      console.log('⚠️  WARNING: No tenant schemas found! Onboarding may not be working.');
    }
    
    // 4. Check public schema has only control tables
    const publicTables = bySchema['public'] || [];
    const allowedPublicTables = ['users', 'businesses', 'outlets', 'super_admin_users', 'audit_logs', 'sequelizemeta'];
    const unexpectedPublic = publicTables.filter(t => !allowedPublicTables.includes(t) && !t.startsWith('pg_'));
    
    if (unexpectedPublic.length > 0) {
      console.log(`\n⚠️  WARNING: Unexpected tables in public schema:`);
      unexpectedPublic.forEach(t => console.log(`   - ${t}`));
    } else {
      console.log(`\n✅ Public schema contains only control-plane tables`);
    }
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

verifyDatabase();
