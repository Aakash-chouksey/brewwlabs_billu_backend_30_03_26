#!/usr/bin/env node
/**
 * BACKGROUND SCHEMA INITIALIZATION SCRIPT
 * Run this manually or as a background job after onboarding
 * 
 * Usage:
 *   node scripts/initTenantSchema.js tenant_<businessId>
 *   OR
 *   node scripts/initTenantSchema.js --all-pending
 */

const { sequelize } = require('../config/unified_database');
const { syncTenantModels } = require('../src/architecture/modelLoader');
const { TenantRegistry } = require('../control_plane_models');

/**
 * Initialize a single tenant schema
 */
const initTenantSchema = async (schemaName) => {
  const startTime = Date.now();
  
  console.log(`🚀 Initializing schema: ${schemaName}`);
  
  try {
    // Step 1: Create schema if not exists
    await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    console.log(`✅ Schema created/verified: ${schemaName}`);
    
    // Step 2: Sync all tenant models
    const result = await syncTenantModels(sequelize, schemaName);
    
    // Step 3: Update TenantRegistry status
    await TenantRegistry.update(
      { status: 'active', initializedAt: new Date() },
      { where: { schemaName } }
    );
    
    const duration = Date.now() - startTime;
    console.log(`✅ Schema ${schemaName} initialized in ${duration}ms`);
    console.log(`   Models synced: ${result.syncedModels.length}`);
    
    return { success: true, schemaName, duration, ...result };
  } catch (error) {
    console.error(`❌ Schema ${schemaName} initialization failed:`, error.message);
    
    // Update status to failed
    await TenantRegistry.update(
      { status: 'init_failed', initError: error.message },
      { where: { schemaName } }
    );
    
    throw error;
  }
};

/**
 * Initialize all pending schemas
 */
const initAllPending = async () => {
  console.log('🔍 Finding pending schemas...');
  
  const pending = await TenantRegistry.findAll({
    where: { status: 'pending_schema_init' }
  });
  
  console.log(`Found ${pending.length} pending schemas`);
  
  for (const registry of pending) {
    try {
      await initTenantSchema(registry.schemaName);
    } catch (error) {
      console.error(`Failed to init ${registry.schemaName}:`, error.message);
    }
  }
};

// CLI Execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--all-pending')) {
    initAllPending()
      .then(() => {
        console.log('✅ All pending schemas processed');
        process.exit(0);
      })
      .catch((error) => {
        console.error('❌ Batch init failed:', error);
        process.exit(1);
      });
  } else if (args.length > 0) {
    const schemaName = args[0];
    initTenantSchema(schemaName)
      .then(() => {
        console.log('✅ Schema initialized');
        process.exit(0);
      })
      .catch((error) => {
        console.error('❌ Init failed:', error);
        process.exit(1);
      });
  } else {
    console.log('Usage:');
    console.log('  node scripts/initTenantSchema.js <schema_name>');
    console.log('  node scripts/initTenantSchema.js --all-pending');
    process.exit(1);
  }
}

module.exports = { initTenantSchema, initAllPending };
