#!/usr/bin/env node

/**
 * 🔧 CONTROL PLANE INITIALIZATION SCRIPT
 * 
 * This script initializes the control plane database with all required tables
 * and fixes the "relation 'brands' does not exist" error.
 * 
 * Usage: node scripts/initialize_control_plane.js
 */

require('dotenv').config({ override: true });
const { controlPlaneSequelize } = require('../config/control_plane_db');

// ANSI color codes for output
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

async function checkEnvironment() {
  log('blue', '🔍 Checking environment configuration...');
  
  const requiredVars = [
    'CONTROL_PLANE_DATABASE_URL',
    'ENCRYPTION_KEY'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    log('red', `❌ Missing environment variables: ${missing.join(', ')}`);
    log('yellow', 'Please set the following environment variables:');
    missing.forEach(varName => {
      log('yellow', `  export ${varName}=your_value_here`);
    });
    return false;
  }
  
  // Check encryption key format
  const encryptionKey = process.env.ENCRYPTION_KEY;
  const keyBuffer = Buffer.from(encryptionKey, 'hex');
  if (keyBuffer.length !== 32) {
    log('red', `❌ ENCRYPTION_KEY must be 64 hex characters, got ${keyBuffer.length} bytes`);
    return false;
  }
  
  log('green', '✅ Environment configuration is valid');
  return true;
}

/**
 * 🔧 DATA-FIRST INITIALIZATION
 * Uses migrations instead of sync()
 */
async function initializeControlPlane() {
  try {
    log('cyan', '🚀 Starting control plane initialization (DATA-FIRST MODE)...');
    
    // 1. Test database connection
    log('blue', '🔌 Testing database connection...');
    await controlPlaneSequelize.authenticate();
    log('green', '✅ Database connection successful');
    
    // 2. Run migrations instead of sync()
    log('blue', '🔧 Running control plane migrations...');
    const migrationRunner = require('../src/architecture/migrationRunner');
    const path = require('path');
    
    // Create a minimal tenant models object for migration tracking
    const SchemaVersion = require('../models/schemaVersionModel')(controlPlaneSequelize);
    const tenantModels = { SchemaVersion: SchemaVersion.schema('public') };
    
    const migrationPath = path.join(__dirname, '../migrations/control-plane');
    await migrationRunner.runPendingMigrations(controlPlaneSequelize, 'public', tenantModels, migrationPath);
    log('green', '✅ Migrations complete');
    
    // 3. Verify tables exist
    log('blue', '🔍 Verifying tables...');
    const [finalTables] = await controlPlaneSequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    const requiredTables = ['businesses', 'users', 'tenant_connections', 
                           'subscriptions', 'super_admin_users', 'cluster_metadata', 
                           'tenant_migration_log', 'plans', 'audit_logs', 'tenant_registry'];
    const missingTables = requiredTables.filter(table => 
      !finalTables.some(t => t.table_name === table)
    );
    
    if (missingTables.length > 0) {
      log('red', `❌ Missing tables: ${missingTables.join(', ')}`);
      throw new Error(`Missing required tables: ${missingTables.join(', ')}`);
    }
    
    log('green', '✅ All required tables exist');
    
    // 4. Test business creation
    log('blue', '🧪 Testing business creation...');
    const controlModels = require('../control_plane_models');
    await controlModels.init();
    
    const testBusiness = await controlModels.Business.create({
      name: 'Test Business',
      email: 'test@example.com',
      status: 'active'
    });
    
    log('green', `✅ Test business created: ${testBusiness.id}`);
    await testBusiness.destroy();
    log('green', '✅ Cleanup complete');
    
    log('green', '🎉 Control plane initialization completed!');
    return true;
    
  } catch (error) {
    log('red', `❌ Control plane initialization failed: ${error.message}`);
    log('red', `Stack: ${error.stack}`);
    return false;
  }
}

async function main() {
  log('bright', '🚀 CONTROL PLANE INITIALIZATION');
  log('bright', '================================');
  
  // Check environment
  const envValid = await checkEnvironment();
  if (!envValid) {
    process.exit(1);
  }
  
  // Initialize control plane
  const success = await initializeControlPlane();
  
  if (success) {
    log('green', '\n🎉 SUCCESS: Control plane is ready for use!');
    log('green', '✅ businesses table exists and is functional');
    log('green', '✅ All control plane tables are ready');
    log('green', '✅ Schema fixes applied');
    log('green', '✅ Business creation tested successfully');
    
    log('cyan', '\n📋 NEXT STEPS:');
    log('cyan', '1. Restart your application server');
    log('cyan', '2. Test the onboarding process');
    log('cyan', '3. Monitor for any remaining issues');
    
    process.exit(0);
  } else {
    log('red', '\n❌ FAILURE: Control plane initialization failed');
    log('red', 'Please check the error messages above and fix the issues');
    log('yellow', 'Common fixes:');
    log('yellow', '1. Ensure CONTROL_PLANE_DATABASE_URL is correct');
    log('yellow', '2. Check database permissions');
    log('yellow', '3. Verify ENCRYPTION_KEY format (64 hex chars)');
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('yellow', '\n👋 Initialization interrupted by user');
  process.exit(130);
});

process.on('SIGTERM', () => {
  log('yellow', '\n👋 Initialization terminated');
  process.exit(143);
});

// Run initialization
if (require.main === module) {
  main().catch(error => {
    log('red', `💥 Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { initializeControlPlane, checkEnvironment };
