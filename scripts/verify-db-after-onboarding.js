const { sequelize } = require('../config/unified_database');

async function verifyDatabaseState() {
  await sequelize.authenticate();
  
  console.log('=== DATABASE STATE VERIFICATION ===\n');
  
  // 1. Check tenant registry
  const [registry] = await sequelize.query('SELECT * FROM public.tenant_registry LIMIT 5');
  console.log('1. Tenant Registry Entries:');
  registry.forEach(r => {
    console.log(`   - Schema: ${r.schema_name}`);
    console.log(`     Status: ${r.status}`);
    console.log(`     Business ID: ${r.business_id}`);
    console.log(`     Created: ${r.created_at}`);
    console.log();
  });
  
  // 2. Check tenant schemas
  const [schemas] = await sequelize.query(
    "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'"
  );
  console.log('2. Tenant Schemas Found:', schemas.length);
  schemas.forEach(s => console.log(`   - ${s.schema_name}`));
  console.log();
  
  // 3. Check tables in first tenant schema
  if (schemas.length > 0) {
    const schema = schemas[0].schema_name;
    const [tables] = await sequelize.query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = '${schema}' AND table_type = 'BASE TABLE'`
    );
    console.log(`3. Tables in ${schema}:`);
    tables.forEach(t => console.log(`   - ${t.table_name}`));
    console.log();
    
    // 4. Verify essential tables exist
    const requiredTables = ['outlets', 'products', 'orders', 'categories'];
    const existingTables = tables.map(t => t.table_name);
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    
    if (missingTables.length === 0) {
      console.log('✅ All essential tables present');
    } else {
      console.log('❌ Missing tables:', missingTables.join(', '));
    }
  }
  
  // 5. Check no control tables in tenant schema
  const controlTables = ['businesses', 'users', 'tenant_registry'];
  console.log('\n5. Checking for misplaced control tables in tenant schemas...');
  
  for (const schema of schemas.slice(0, 2)) {
    const [tables] = await sequelize.query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = '${schema.schema_name}' 
       AND table_name IN ('businesses', 'users', 'tenant_registry')`
    );
    if (tables.length > 0) {
      console.log(`   ❌ ${schema.schema_name} has control tables:`, tables.map(t => t.table_name).join(', '));
    } else {
      console.log(`   ✅ ${schema.schema_name}: No control tables`);
    }
  }
  
  console.log('\n=== VERIFICATION COMPLETE ===');
  await sequelize.close();
}

verifyDatabaseState().catch(console.error);
