const { sequelize } = require('../config/unified_database');

async function checkSchemaIsolation() {
  try {
    console.log('🔍 Checking for tenant tables in public schema...');
    const [publicTables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name NOT IN (
        'users', 'businesses', 'subscriptions', 'plans', 'audit_logs', 'tenant_registry', 
        'system_metrics', 'membership_plans', 'partner_types', 'partner_memberships', 
        'partner_wallets', 'feature_flags', 'web_contents', 'SequelizeMeta', 'SequelizeData'
      )
    `);

    if (publicTables.length > 0) {
      console.error('❌ POLLUTION DETECTED: Found tenant tables in public schema:', publicTables.map(t => t.table_name).join(', '));
    } else {
      console.log('✅ Public schema is clean (Control Plane only).');
    }

    console.log('\n🔍 Listing all schemas:');
    const [schemas] = await sequelize.query('SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE \'tenant_%\'');
    console.log('Total tenant schemas found:', schemas.length);
    schemas.forEach(s => console.log(' - ' + s.schema_name));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during schema check:', error.message);
    process.exit(1);
  }
}

checkSchemaIsolation();
