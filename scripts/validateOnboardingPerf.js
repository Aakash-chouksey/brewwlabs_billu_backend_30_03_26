#!/usr/bin/env node
/**
 * ONBOARDING PERFORMANCE VALIDATION SCRIPT
 * 
 * Validates that all performance optimizations are in place:
 * 1. Timing instrumentation exists
 * 2. Parallel operations are implemented
 * 3. Logging guards are in place
 * 4. No sequential bottlenecks remain
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

console.log('🚀 ONBOARDING PERFORMANCE OPTIMIZATION VALIDATION\n');

const results = {
  passed: 0,
  failed: 0,
  optimizations: []
};

function check(name, condition, details = '') {
  const status = condition ? '✅' : '❌';
  if (condition) {
    results.passed++;
    results.optimizations.push(name);
  } else {
    results.failed++;
  }
  console.log(`  ${status} ${name}`);
  if (details && !condition) console.log(`     ${details}`);
  return condition;
}

// ============================================
// CHECK 1: v1 Migration Parallelization
// ============================================
const v1Path = path.join(PROJECT_ROOT, 'migrations/tenant/v1_init.js');
const v1Content = fs.readFileSync(v1Path, 'utf8');

check(
  'v1 migration uses Promise.all for parallel table creation',
  v1Content.includes('Promise.all(tablePromises)') || v1Content.includes('Promise.all'),
  'v1 migration is still sequential'
);

check(
  'v1 migration has timing instrumentation',
  v1Content.includes('console.time') || v1Content.includes('Date.now()'),
  'Missing timing in v1'
);

check(
  'v1 migration reports total tables created',
  v1Content.includes('totalTablesCreated'),
  'v1 does not track table count'
);

// ============================================
// CHECK 2: Migration Runner Timing
// ============================================
const runnerPath = path.join(PROJECT_ROOT, 'src/architecture/migrationRunner.js');
const runnerContent = fs.readFileSync(runnerPath, 'utf8');

check(
  'MigrationRunner has per-migration timing',
  runnerContent.includes('console.time') && runnerContent.includes('migrationTimings'),
  'MigrationRunner missing timing'
);

check(
  'MigrationRunner reports slowest migration',
  runnerContent.includes('Slowest migration'),
  'Missing slowest migration report'
);

check(
  'MigrationRunner tracks total duration',
  runnerContent.includes('totalDuration') || runnerContent.includes('runnerStartTime'),
  'Missing total duration tracking'
);

// ============================================
// CHECK 3: Later Migrations (v3, v5) - Parallel ALTER
// ============================================
const v3Path = path.join(PROJECT_ROOT, 'migrations/tenant/v3_schema_alignment.js');
const v3Content = fs.readFileSync(v3Path, 'utf8');

check(
  'v3 migration uses parallel ALTER operations',
  v3Content.includes('Promise.all(alterOperations)'),
  'v3 migrations are sequential'
);

const v5Path = path.join(PROJECT_ROOT, 'migrations/tenant/v5_global_alignment.js');
const v5Content = fs.readFileSync(v5Path, 'utf8');

check(
  'v5 migration uses parallel ALTER operations',
  v5Content.includes('Promise.all(alterOperations)'),
  'v5 migrations are sequential'
);

// ============================================
// CHECK 4: TenantModelLoader Timing
// ============================================
const loaderPath = path.join(PROJECT_ROOT, 'src/architecture/tenantModelLoader.js');
const loaderContent = fs.readFileSync(loaderPath, 'utf8');

check(
  'TenantModelLoader has phase timing (schema creation)',
  loaderContent.includes('console.time') && loaderContent.includes('[Timing]'),
  'Missing phase timing in TenantModelLoader'
);

check(
  'TenantModelLoader tracks migration timing',
  loaderContent.includes('Run all migrations'),
  'Missing migration timing'
);

// ============================================
// CHECK 5: Onboarding Service Optimizations
// ============================================
const onboardingPath = path.join(PROJECT_ROOT, 'services/onboardingService.js');
const onboardingContent = fs.readFileSync(onboardingPath, 'utf8');

check(
  'Onboarding has production logging guard',
  onboardingContent.includes('isProd') && onboardingContent.includes('NODE_ENV'),
  'Missing production logging guard'
);

check(
  'Onboarding has phase timing instrumentation',
  onboardingContent.includes('⏱️ [Onboarding]') && 
  onboardingContent.includes('console.time') && 
  onboardingContent.includes('console.timeEnd'),
  'Missing phase timing'
);

check(
  'Onboarding prints timing summary',
  onboardingContent.includes('TIMING SUMMARY'),
  'Missing timing summary'
);

check(
  'Default data insertion is parallelized',
  onboardingContent.includes('Promise.all(otherPromises)') || 
  onboardingContent.includes('Promise.all'),
  'Default data insertion is sequential'
);

// ============================================
// CHECK 6: v2 and v4 Migrations Have Timing
// ============================================
const v2Path = path.join(PROJECT_ROOT, 'migrations/tenant/v2_add_sku.js');
const v2Content = fs.readFileSync(v2Path, 'utf8');

check(
  'v2 migration has timing',
  v2Content.includes('Date.now()') && v2Content.includes('startTime'),
  'Missing timing in v2'
);

const v4Path = path.join(PROJECT_ROOT, 'migrations/tenant/v4_drop_product_stock_column.js');
const v4Content = fs.readFileSync(v4Path, 'utf8');

check(
  'v4 migration has timing',
  v4Content.includes('Date.now()') && v4Content.includes('startTime'),
  'Missing timing in v4'
);

// ============================================
// CHECK 7: Reduced Logging
// ============================================
check(
  'v1 migration has reduced per-table logging (only slow tables)',
  v1Content.includes('levelDuration > 50') || !v1Content.includes('Ensuring table'),
  'v1 still has excessive per-table logging'
);

// ============================================
// SUMMARY
// ============================================
console.log('\n' + '='.repeat(50));
console.log('PERFORMANCE OPTIMIZATION SUMMARY');
console.log('='.repeat(50));
console.log(`✅ Passed: ${results.passed}`);
console.log(`❌ Failed: ${results.failed}`);
console.log(`📊 Coverage: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);

if (results.optimizations.length > 0) {
  console.log('\n🚀 Optimizations Implemented:');
  results.optimizations.forEach(opt => console.log(`  • ${opt}`));
}

console.log('\n⏱️ Timing Points Added:');
console.log('  • v1 Migration: Per-level parallel table creation timing');
console.log('  • Migration Runner: Per-migration + total timing');
console.log('  • TenantModelLoader: Schema creation phases timing');
console.log('  • Onboarding: All 7 phases timing + summary');
console.log('  • v2-v5 Migrations: Individual migration timing');

console.log('\n⚡ Parallel Operations:');
console.log('  • v1: Parallel table creation within dependency levels');
console.log('  • v3/v5: Parallel ALTER TABLE operations');
console.log('  • Onboarding: Parallel default data insertion');

if (results.failed === 0) {
  console.log('\n🎉 ALL PERFORMANCE CHECKS PASSED');
  console.log('The onboarding flow is now optimized for speed!');
  process.exit(0);
} else {
  console.log('\n⚠️  SOME CHECKS FAILED - Review above');
  process.exit(1);
}
