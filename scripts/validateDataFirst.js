#!/usr/bin/env node
/**
 * SCHEMA GUARD VALIDATION SCRIPT
 * 
 * Tests the strict data-first architecture implementation:
 * 1. STRICT_SCHEMA_MODE enforcement
 * 2. Migration-only onboarding
 * 3. No sync() operations
 * 4. Schema mismatch detection
 */

const fs = require('fs');
const path = require('path');

// Get project root (parent of scripts directory)
const PROJECT_ROOT = path.join(__dirname, '..');

console.log('🔍 DATA-FIRST ARCHITECTURE VALIDATION\n');

const results = {
  passed: 0,
  failed: 0,
  checks: []
};

function check(name, condition, details = '') {
  const status = condition ? '✅' : '❌';
  results.checks.push({ name, passed: condition, details });
  if (condition) results.passed++; else results.failed++;
  console.log(`  ${status} ${name}`);
  if (details && !condition) console.log(`     ${details}`);
  return condition;
}

// ============================================
// CHECK 1: Schema Guard has STRICT_SCHEMA_MODE
// ============================================
const schemaGuardPath = path.join(PROJECT_ROOT, 'src/architecture/schemaGuard.js');
const schemaGuardContent = fs.readFileSync(schemaGuardPath, 'utf8');

check(
  'Schema Guard has STRICT_SCHEMA_MODE support',
  schemaGuardContent.includes('STRICT_SCHEMA_MODE'),
  'Missing STRICT_SCHEMA_MODE in SchemaGuard'
);

check(
  'Schema Guard reads STRICT_SCHEMA_MODE from env',
  schemaGuardContent.includes('process.env.STRICT_SCHEMA_MODE'),
  'Not reading STRICT_SCHEMA_MODE from environment'
);

check(
  'Schema Guard blocks on mismatches in strict mode',
  schemaGuardContent.includes('this.strictMode') && 
  schemaGuardContent.includes('STRICT_SCHEMA_MODE enabled:') &&
  schemaGuardContent.includes('throw new Error'),
  'Not properly blocking startup in strict mode'
);

// ============================================
// CHECK 2: No sync() in codebase
// ============================================
const srcPath = path.join(PROJECT_ROOT, 'src');
const architecturePath = path.join(PROJECT_ROOT, 'src/architecture');

// Check for any .sync( calls in src/architecture (should be none)
function checkNoSync(dirPath, label) {
  if (!fs.existsSync(dirPath)) {
    check(`No sync() in ${label}`, true);
    return;
  }
  
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.js'));
  let hasSync = false;
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
    // Look for actual sync calls, not just comments containing "sync"
    const syncMatches = content.match(/\.sync\s*\(/g);
    if (syncMatches) {
      hasSync = true;
      console.log(`     ⚠️  Found .sync() in ${file}`);
    }
  }
  
  check(`No .sync() calls in ${label}`, !hasSync, 'Found .sync() calls');
}

checkNoSync(architecturePath, 'src/architecture');

// ============================================
// CHECK 3: Onboarding is 100% migration-only
// ============================================
const onboardingPath = path.join(PROJECT_ROOT, 'services/onboardingService.js');
const onboardingContent = fs.readFileSync(onboardingPath, 'utf8');

check(
  'Onboarding uses initializeTenantSchema (migrations)',
  onboardingContent.includes('initializeTenantSchema'),
  'Onboarding not using migration-based initialization'
);

check(
  'Onboarding has NO auto-repair function calls',
  !onboardingContent.includes('repairTenantSchema(') &&
  !onboardingContent.includes('.repair('),
  'Onboarding still has auto-repair function calls (violates data-first)'
);

check(
  'Onboarding throws on schema integrity failure',
  onboardingContent.includes('Schema integrity check failed') &&
  onboardingContent.includes('throw new Error'),
  'Onboarding does not fail fast on schema issues'
);

check(
  'Onboarding requires migrations to be fixed',
  onboardingContent.includes('Migrations must be fixed'),
  'Onboarding message does not guide to fix migrations'
);

// ============================================
// CHECK 4: DataFirstInitializer integration
// ============================================
const dataFirstInitPath = path.join(PROJECT_ROOT, 'src/architecture/dataFirstInitializer.js');
const dataFirstInitContent = fs.readFileSync(dataFirstInitPath, 'utf8');

check(
  'DataFirstInitializer supports STRICT_SCHEMA_MODE',
  dataFirstInitContent.includes('STRICT_SCHEMA_MODE') ||
  dataFirstInitContent.includes('strictMode'),
  'DataFirstInitializer missing strict mode support'
);

check(
  'DataFirstInitializer has Phase 7 tenant validation',
  dataFirstInitContent.includes('_phase7_tenantSchemaGuard'),
  'Missing Phase 7 tenant schema validation'
);

check(
  'DataFirstInitializer validates all tenants at startup',
  dataFirstInitContent.includes('validateAllTenants'),
  'Not validating all tenants at startup'
);

// ============================================
// CHECK 5: App.js integration
// ============================================
const appPath = path.join(PROJECT_ROOT, 'app.js');
const appContent = fs.readFileSync(appPath, 'utf8');

check(
  'App.js uses DataFirstInitializer',
  appContent.includes('initializeDataFirst') ||
  appContent.includes('dataFirst'),
  'App.js not using DataFirstInitializer'
);

check(
  'App.js passes STRICT_SCHEMA_MODE to initializer',
  appContent.includes('STRICT_SCHEMA_MODE'),
  'STRICT_SCHEMA_MODE not passed to initializer'
);

// ============================================
// CHECK 6: Environment documentation
// ============================================
const envExamplePath = path.join(PROJECT_ROOT, '.env.example');
const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');

check(
  '.env.example has STRICT_SCHEMA_MODE documentation',
  envExampleContent.includes('STRICT_SCHEMA_MODE'),
  'Missing STRICT_SCHEMA_MODE in .env.example'
);

check(
  '.env.example removed deprecated DB_SYNC',
  !envExampleContent.includes('DB_SYNC=true') ||
  envExampleContent.includes('DEPRECATED') ||
  envExampleContent.includes('# DB_SYNC'),
  'DB_SYNC still enabled in .env.example'
);

// ============================================
// CHECK 7: Migration-only enforcement
// ============================================
const tenantModelLoaderPath = path.join(PROJECT_ROOT, 'src/architecture/tenantModelLoader.js');
const tenantModelLoaderContent = fs.readFileSync(tenantModelLoaderPath, 'utf8');

check(
  'tenantModelLoader.initializeTenantSchema runs migrations',
  tenantModelLoaderContent.includes('migrationRunner') &&
  tenantModelLoaderContent.includes('runPendingMigrations'),
  'Schema initialization not running migrations'
);

check(
  'tenantModelLoader removed repairTenantSchema',
  !tenantModelLoaderContent.includes('repairTenantSchema'),
  'repairTenantSchema still exists (violates data-first)'
);

// ============================================
// SUMMARY
// ============================================
console.log('\n' + '='.repeat(50));
console.log('VALIDATION SUMMARY');
console.log('='.repeat(50));
console.log(`✅ Passed: ${results.passed}`);
console.log(`❌ Failed: ${results.failed}`);
console.log(`📊 Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);

if (results.failed === 0) {
  console.log('\n🎉 ALL CHECKS PASSED - Data-First Architecture is STRICT');
  process.exit(0);
} else {
  console.log('\n⚠️  SOME CHECKS FAILED - Review failures above');
  process.exit(1);
}
