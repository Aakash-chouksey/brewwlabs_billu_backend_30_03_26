#!/usr/bin/env node
/**
 * ============================================================================
 * DATABASE VERIFICATION SCRIPT
 * ============================================================================
 * 
 * This script verifies the database state after onboarding:
 * - Checks all schemas exist
 * - Verifies tables per schema
 * - Validates no tenant tables in public
 * - Cross-references tenant_registry
 * 
 * Usage: node scripts/verify_database.js
 */

require('dotenv').config({ override: true });
const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.cyan}\n▶️  ${msg}${colors.reset}`),
  header: (msg) => console.log(`${colors.magenta}\n${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}${colors.reset}`),
  pass: (msg) => console.log(`${colors.green}\n✅ PASS: ${msg}${colors.reset}`),
  fail: (msg) => console.log(`${colors.red}\n❌ FAIL: ${msg}${colors.reset}`),
};

// Expected tenant table count (approximate range)
const MIN_TENANT_TABLES = 25;
const MAX_TENANT_TABLES = 50;

// Control plane tables that SHOULD exist in public
const EXPECTED_PUBLIC_TABLES = [
  'users',
  'businesses',
  'tenant_registry',
  'audit_logs',
  'system_metrics',
];

// Tables that should NEVER be in public (tenant-only)
const TENANT_ONLY_TABLES = [
  'products', 'orders', 'outlets', 'inventory_items', 'inventory_categories',
  'customers', 'customer_ledgers', 'customer_transactions',
  'recipes', 'recipe_items', 'purchases', 'purchase_items',
  'suppliers', 'tables', 'categories', 'expenses', 'expense_types',
  'payments', 'stock_transactions', 'wastage', 'roll_tracking',
  'membership_plans', 'partner_memberships', 'partner_wallets',
  'areas', 'settings', 'web_contents', 'features',
];

async function verifyDatabase() {
  log.header('DATABASE VERIFICATION - STARTING');
  
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URI;
  
  if (!databaseUrl) {
    log.error('DATABASE_URL environment variable is not set!');
    process.exit(1);
  }
  
  // Load onboarding results if available
  let onboardingResults = null;
  const resultsFile = path.join(__dirname, 'onboarding_test_results.json');
  if (fs.existsSync(resultsFile)) {
    try {
      onboardingResults = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
      log.info(`Loaded onboarding results from: ${resultsFile}`);
      log.info(`Timestamp: ${onboardingResults.timestamp}`);
    } catch (error) {
      log.warning(`Could not load onboarding results: ${error.message}`);
    }
  }
  
  // Create Sequelize instance
  const sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    logging: false,
  });
  
  const validationResults = {
    checks: [],
    passed: 0,
    failed: 0,
    warnings: 0,
  };
  
  function addCheck(name, passed, message, severity = 'error') {
    validationResults.checks.push({ name, passed, message, severity });
    if (passed) {
      validationResults.passed++;
    } else if (severity === 'warning') {
      validationResults.warnings++;
    } else {
      validationResults.failed++;
    }
  }
  
  try {
    // Test connection
    log.step('Connecting to database...');
    await sequelize.authenticate();
    log.success('Database connection established');
    
    // ========================================================================
    // CHECK 1: List all schemas
    // ========================================================================
    log.step('Checking schemas...');
    
    const [allSchemas] = await sequelize.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name
    `);
    
    const schemaNames = allSchemas.map(s => s.schema_name);
    const tenantSchemas = schemaNames.filter(s => s.startsWith('tenant_'));
    
    log.info(`Found ${schemaNames.length} schemas:`);
    schemaNames.forEach(s => {
      const isTenant = s.startsWith('tenant_');
      console.log(`   ${isTenant ? '🏢' : '📁'} ${s}`);
    });
    
    // Check we have public schema
    addCheck('Public schema exists', schemaNames.includes('public'), 
      schemaNames.includes('public') ? 'public schema found' : 'public schema MISSING!');
    
    // Check tenant count matches onboarding
    if (onboardingResults && onboardingResults.results) {
      const expectedTenants = onboardingResults.results.successful.length;
      const actualTenants = tenantSchemas.length;
      
      addCheck('Tenant count matches onboarding', expectedTenants === actualTenants,
        `Expected ${expectedTenants} tenant schemas, found ${actualTenants}`,
        expectedTenants !== actualTenants ? 'error' : 'info');
    }
    
    // ========================================================================
    // CHECK 2: Verify public schema tables
    // ========================================================================
    log.step('Checking public schema tables...');
    
    const [publicTables] = await sequelize.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    
    const publicTableNames = publicTables.map(t => t.tablename);
    
    log.info(`Found ${publicTableNames.length} tables in public:`);
    publicTableNames.forEach(t => console.log(`   - ${t}`));
    
    // Check expected control plane tables exist
    EXPECTED_PUBLIC_TABLES.forEach(table => {
      const exists = publicTableNames.includes(table);
      addCheck(`Control plane table: ${table}`, exists,
        exists ? `${table} found` : `${table} MISSING!`);
    });
    
    // Check for tenant tables in public (should NOT exist)
    const tenantTablesInPublic = publicTableNames.filter(t => 
      TENANT_ONLY_TABLES.some(pattern => t.toLowerCase().includes(pattern.toLowerCase()))
    );
    
    addCheck('No tenant tables in public', tenantTablesInPublic.length === 0,
      tenantTablesInPublic.length === 0 
        ? 'No tenant tables found in public'
        : `Found ${tenantTablesInPublic.length} tenant tables in public: ${tenantTablesInPublic.join(', ')}`,
      'error');
    
    // ========================================================================
    // CHECK 3: Verify each tenant schema
    // ========================================================================
    log.step('Checking tenant schemas...');
    
    const tenantResults = [];
    
    for (const schemaName of tenantSchemas) {
      const [tables] = await sequelize.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = '${schemaName}'
        ORDER BY tablename
      `);
      
      const tableCount = tables.length;
      const tableNames = tables.map(t => t.tablename);
      
      const hasMinimumTables = tableCount >= MIN_TENANT_TABLES;
      const hasMaximumTables = tableCount <= MAX_TENANT_TABLES;
      
      tenantResults.push({
        schema: schemaName,
        tableCount,
        tables: tableNames,
        hasMinimumTables,
        hasMaximumTables,
        isValid: hasMinimumTables && hasMaximumTables,
      });
      
      const status = hasMinimumTables ? '✅' : '❌';
      const color = hasMinimumTables ? colors.green : colors.red;
      console.log(`   ${color}${status} ${schemaName}: ${tableCount} tables${colors.reset}`);
    }
    
    // Validate each tenant schema
    tenantResults.forEach(tenant => {
      addCheck(`${tenant.schema} has tables`, tenant.hasMinimumTables,
        tenant.hasMinimumTables 
          ? `${tenant.schema} has ${tenant.tableCount} tables`
          : `${tenant.schema} has only ${tenant.tableCount} tables (min: ${MIN_TENANT_TABLES})`,
        'error');
    });
    
    // ========================================================================
    // CHECK 4: Verify tenant_registry entries
    // ========================================================================
    log.step('Checking tenant_registry...');
    
    try {
      const [registryEntries] = await sequelize.query(`
        SELECT id, business_id, schema_name, status, created_at
        FROM public.tenant_registry
        ORDER BY created_at DESC
      `);
      
      log.info(`Found ${registryEntries.length} entries in tenant_registry`);
      
      registryEntries.forEach(entry => {
        console.log(`   🏢 ${entry.schema_name} → Business: ${entry.business_id?.substring(0, 8)}... Status: ${entry.status}`);
      });
      
      // Cross-reference with actual schemas
      const registeredSchemas = registryEntries.map(e => e.schema_name);
      const missingFromRegistry = tenantSchemas.filter(s => !registeredSchemas.includes(s));
      const extraInRegistry = registeredSchemas.filter(s => !tenantSchemas.includes(s));
      
      addCheck('All tenant schemas registered', missingFromRegistry.length === 0,
        missingFromRegistry.length === 0
          ? 'All schemas registered in tenant_registry'
          : `Unregistered schemas: ${missingFromRegistry.join(', ')}`,
        'warning');
      
      addCheck('No orphaned registry entries', extraInRegistry.length === 0,
        extraInRegistry.length === 0
          ? 'No orphaned registry entries'
          : `Orphaned entries: ${extraInRegistry.join(', ')}`,
        'warning');
      
      // Check registry matches onboarding
      if (onboardingResults) {
        const successfulOnboardings = onboardingResults.results.successful;
        const registryBusinessIds = registryEntries.map(e => e.business_id);
        
        const missingInRegistry = successfulOnboardings.filter(
          o => !registryBusinessIds.includes(o.businessId)
        );
        
        addCheck('All onboarded businesses in registry', missingInRegistry.length === 0,
          missingInRegistry.length === 0
            ? 'All onboarded businesses registered'
            : `Missing: ${missingInRegistry.map(o => o.name).join(', ')}`,
          'error');
      }
      
    } catch (error) {
      log.error(`Could not query tenant_registry: ${error.message}`);
      addCheck('tenant_registry query', false, error.message, 'error');
    }
    
    // ========================================================================
    // FINAL SUMMARY
    // ========================================================================
    log.header('VERIFICATION SUMMARY');
    
    console.log(`\n${colors.cyan}Validation Results:${colors.reset}`);
    console.log(`   ✅ Passed: ${validationResults.passed}`);
    console.log(`   ❌ Failed: ${validationResults.failed}`);
    console.log(`   ⚠️  Warnings: ${validationResults.warnings}`);
    
    console.log(`\n${colors.cyan}Detailed Checks:${colors.reset}`);
    validationResults.checks.forEach(check => {
      const icon = check.passed ? '✅' : (check.severity === 'warning' ? '⚠️' : '❌');
      const color = check.passed ? colors.green : (check.severity === 'warning' ? colors.yellow : colors.red);
      console.log(`   ${color}${icon} ${check.name}: ${check.message}${colors.reset}`);
    });
    
    // ========================================================================
    // FINAL VERDICT
    // ========================================================================
    const allCriticalPassed = validationResults.checks
      .filter(c => c.severity === 'error')
      .every(c => c.passed);
    
    log.header('FINAL RESULT');
    
    if (allCriticalPassed) {
      log.pass('ALL CRITICAL CHECKS PASSED');
      console.log(`\n${colors.green}✅ DATABASE IS PROPERLY CONFIGURED${colors.reset}`);
      console.log(`\n${colors.cyan}Summary:${colors.reset}`);
      console.log(`   • ${tenantSchemas.length} tenant schemas created`);
      console.log(`   • ${publicTableNames.length} control plane tables`);
      console.log(`   • All schemas have ${MIN_TENANT_TABLES}+ tables`);
      console.log(`   • No tenant tables in public schema`);
    } else {
      log.fail('CRITICAL CHECKS FAILED');
      console.log(`\n${colors.red}❌ DATABASE VERIFICATION FAILED${colors.reset}`);
      console.log(`\n${colors.yellow}Action Required:${colors.reset}`);
      console.log('   Review failed checks above and fix issues.');
    }
    
    // Save verification report
    const reportFile = path.join(__dirname, 'database_verification_report.json');
    fs.writeFileSync(reportFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        totalSchemas: schemaNames.length,
        tenantSchemas: tenantSchemas.length,
        publicTables: publicTableNames.length,
        checksPassed: validationResults.passed,
        checksFailed: validationResults.failed,
        warnings: validationResults.warnings,
        overallPass: allCriticalPassed,
      },
      schemas: schemaNames,
      tenantDetails: tenantResults,
      checks: validationResults.checks,
    }, null, 2));
    
    log.success(`Verification report saved to: ${reportFile}`);
    
    process.exit(allCriticalPassed ? 0 : 1);
    
  } catch (error) {
    log.error(`Verification failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Handle async errors
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});

// Run the script
verifyDatabase();
