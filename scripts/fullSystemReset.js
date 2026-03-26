#!/usr/bin/env node

/**
 * 🚨 FULL SYSTEM RESET AND VERIFICATION SCRIPT
 * 
 * PHASE 1: Drop ALL schemas
 * PHASE 2: Verify control plane tables
 * PHASE 3: Create new tenant
 * PHASE 4-10: Verification and fixes
 */

require('dotenv').config({ override: true });
const { Sequelize } = require('sequelize');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(level, message) {
  const timestamp = new Date().toISOString();
  const color = colors[level] || colors.reset;
  console.log(`${color}[${timestamp}] ${level.toUpperCase()}: ${message}${colors.reset}`);
}

// Create raw connection for admin operations
const sequelize = new Sequelize(process.env.CONTROL_PLANE_DATABASE_URL || process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: false
  }
});

const issues = [];
const fixes = [];

// ============================================
// PHASE 1: FULL DATABASE RESET
// ============================================
async function phase1_resetDatabase() {
  log('bright', '🚨 PHASE 1: FULL DATABASE RESET');
  log('bright', '================================');
  
  try {
    // Test connection
    log('blue', '🔌 Testing database connection...');
    await sequelize.authenticate();
    log('green', '✅ Database connection successful');
    
    // Drop all tenant schemas
    log('yellow', '🔥 Dropping all tenant schemas...');
    const [tenantSchemas] = await sequelize.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'tenant_%'
    `);
    
    log('cyan', `Found ${tenantSchemas.length} tenant schemas to drop`);
    
    for (const { schema_name } of tenantSchemas) {
      try {
        await sequelize.query(`DROP SCHEMA IF EXISTS "${schema_name}" CASCADE`);
        log('green', `  ✅ Dropped ${schema_name}`);
      } catch (error) {
        log('red', `  ❌ Failed to drop ${schema_name}: ${error.message}`);
        issues.push({ phase: 1, schema: schema_name, error: error.message });
      }
    }
    
    // Reset public schema
    log('yellow', '🔥 Resetting public schema...');
    await sequelize.query('DROP SCHEMA IF EXISTS public CASCADE');
    await sequelize.query('CREATE SCHEMA public');
    await sequelize.query('GRANT ALL ON SCHEMA public TO PUBLIC');
    log('green', '✅ Public schema reset');
    
    return true;
  } catch (error) {
    log('red', `❌ Phase 1 failed: ${error.message}`);
    issues.push({ phase: 1, error: error.message });
    return false;
  }
}

// ============================================
// PHASE 2: CONTROL PLANE VERIFICATION
// ============================================
async function phase2_verifyControlPlane() {
  log('bright', '\n🚨 PHASE 2: CONTROL PLANE VERIFICATION');
  log('bright', '=======================================');
  
  const expectedControlTables = [
    'users', 'businesses', 'tenant_registry', 'subscriptions', 'plans', 
    'audit_logs', 'super_admin_users', 'tenant_connections', 'cluster_metadata',
    'tenant_migration_log'
  ];
  
  const forbiddenTables = [
    'orders', 'order_items', 'customers', 'products', 'inventory', 
    'inventory_items', 'categories', 'outlets', 'tables', 'areas'
  ];
  
  try {
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    const tableNames = tables.map(t => t.table_name);
    log('cyan', `📋 Found ${tableNames.length} tables in public schema:`);
    tableNames.forEach(t => log('cyan', `  - ${t}`));
    
    // Check for missing expected tables
    const missing = expectedControlTables.filter(t => !tableNames.includes(t));
    if (missing.length > 0) {
      log('red', `❌ Missing expected control tables: ${missing.join(', ')}`);
      issues.push({ phase: 2, missingTables: missing });
    } else {
      log('green', '✅ All expected control tables exist');
    }
    
    // Check for forbidden tables
    const foundForbidden = forbiddenTables.filter(t => tableNames.includes(t));
    if (foundForbidden.length > 0) {
      log('red', `❌ FORBIDDEN tables found in public schema: ${foundForbidden.join(', ')}`);
      issues.push({ phase: 2, forbiddenTables: foundForbidden });
    } else {
      log('green', '✅ No forbidden tables in public schema');
    }
    
    return { success: true, tables: tableNames, missing, foundForbidden };
  } catch (error) {
    log('red', `❌ Phase 2 failed: ${error.message}`);
    issues.push({ phase: 2, error: error.message });
    return { success: false, error: error.message };
  }
}

// ============================================
// PHASE 4: TENANT SCHEMA VERIFICATION
// ============================================
async function phase4_verifyTenantSchema(tenantId) {
  log('bright', '\n🚨 PHASE 4: TENANT SCHEMA VERIFICATION');
  log('bright', '=======================================');
  
  const schemaName = `tenant_${tenantId}`;
  const expectedTenantTables = [
    'orders', 'order_items', 'customers', 'products', 'categories',
    'inventory_items', 'inventory_categories', 'inventory_transactions',
    'outlets', 'tables', 'areas', 'recipes', 'recipe_items',
    'purchases', 'purchase_items', 'suppliers'
  ];
  
  const forbiddenTenantTables = [
    'users', 'businesses', 'tenant_registry', 'audit_logs',
    'super_admin_users', 'subscriptions', 'plans'
  ];
  
  try {
    // Check if schema exists
    const [schemaExists] = await sequelize.query(`
      SELECT schema_name FROM information_schema.schemata 
      WHERE schema_name = '${schemaName}'
    `);
    
    if (schemaExists.length === 0) {
      log('red', `❌ Tenant schema ${schemaName} does not exist`);
      issues.push({ phase: 4, error: `Schema ${schemaName} missing` });
      return { success: false, exists: false };
    }
    
    log('green', `✅ Tenant schema ${schemaName} exists`);
    
    // Get tables in tenant schema
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = '${schemaName}'
      ORDER BY table_name
    `);
    
    const tableNames = tables.map(t => t.table_name);
    log('cyan', `📋 Found ${tableNames.length} tables in ${schemaName}:`);
    tableNames.forEach(t => log('cyan', `  - ${t}`));
    
    // Check for missing expected tables
    const missing = expectedTenantTables.filter(t => !tableNames.includes(t));
    if (missing.length > 0) {
      log('yellow', `⚠️ Missing expected tenant tables: ${missing.join(', ')}`);
    }
    
    // Check for forbidden tables
    const foundForbidden = forbiddenTenantTables.filter(t => tableNames.includes(t));
    if (foundForbidden.length > 0) {
      log('red', `❌ FORBIDDEN control tables found in tenant schema: ${foundForbidden.join(', ')}`);
      issues.push({ phase: 4, forbiddenInTenant: foundForbidden });
    } else {
      log('green', '✅ No control tables in tenant schema');
    }
    
    return { success: true, tables: tableNames, missing, foundForbidden, exists: true };
  } catch (error) {
    log('red', `❌ Phase 4 failed: ${error.message}`);
    issues.push({ phase: 4, error: error.message });
    return { success: false, error: error.message };
  }
}

// ============================================
// PHASE 5: DATA VERIFICATION
// ============================================
async function phase5_verifyData(tenantId) {
  log('bright', '\n🚨 PHASE 5: DATA VERIFICATION');
  log('bright', '=============================');
  
  const schemaName = `tenant_${tenantId}`;
  
  try {
    // Check public schema data
    log('blue', '🔍 Checking public schema data...');
    
    const [users] = await sequelize.query('SELECT COUNT(*) as count FROM public.users');
    const [businesses] = await sequelize.query('SELECT COUNT(*) as count FROM public.businesses');
    const [tenantRegistry] = await sequelize.query('SELECT COUNT(*) as count FROM public.tenant_registry');
    
    log('cyan', `  📊 public.users: ${users[0].count} records`);
    log('cyan', `  📊 public.businesses: ${businesses[0].count} records`);
    log('cyan', `  📊 public.tenant_registry: ${tenantRegistry[0].count} records`);
    
    // Check tenant schema data
    log('blue', `🔍 Checking tenant schema ${schemaName} data...`);
    
    const [tenantOrders] = await sequelize.query(`
      SELECT COUNT(*) as count FROM "${schemaName}".orders
    `).catch(() => [{ count: 0 }]);
    
    const [tenantCustomers] = await sequelize.query(`
      SELECT COUNT(*) as count FROM "${schemaName}".customers
    `).catch(() => [{ count: 0 }]);
    
    const [tenantProducts] = await sequelize.query(`
      SELECT COUNT(*) as count FROM "${schemaName}".products
    `).catch(() => [{ count: 0 }]);
    
    log('cyan', `  📊 ${schemaName}.orders: ${tenantOrders[0].count} records`);
    log('cyan', `  📊 ${schemaName}.customers: ${tenantCustomers[0].count} records`);
    log('cyan', `  📊 ${schemaName}.products: ${tenantProducts[0].count} records`);
    
    return {
      public: { users: users[0].count, businesses: businesses[0].count, tenantRegistry: tenantRegistry[0].count },
      tenant: { orders: tenantOrders[0].count, customers: tenantCustomers[0].count, products: tenantProducts[0].count }
    };
  } catch (error) {
    log('red', `❌ Phase 5 failed: ${error.message}`);
    issues.push({ phase: 5, error: error.message });
    return { error: error.message };
  }
}

// ============================================
// MAIN EXECUTION
// ============================================
async function main() {
  log('bright', '🚀 FULL SYSTEM RESET & VERIFICATION');
  log('bright', '==================================');
  
  let tenantId = null;
  
  try {
    // PHASE 1: Reset Database
    const p1 = await phase1_resetDatabase();
    if (!p1) throw new Error('Phase 1 failed');
    
    // Close raw connection
    await sequelize.close();
    log('cyan', '\n📋 Database reset complete. Run control plane initialization now.');
    log('cyan', 'Command: npm run migrate:control-plane');
    
    return {
      phase: 'RESET_COMPLETE',
      nextStep: 'Run: npm run migrate:control-plane',
      issues,
      fixes
    };
    
  } catch (error) {
    log('red', `\n💥 FATAL ERROR: ${error.message}`);
    await sequelize.close();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().then(result => {
    console.log('\n' + JSON.stringify(result, null, 2));
    process.exit(0);
  }).catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  phase1_resetDatabase,
  phase2_verifyControlPlane,
  phase4_verifyTenantSchema,
  phase5_verifyData,
  getIssues: () => issues,
  getFixes: () => fixes
};
