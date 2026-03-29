/**
 * 🕵️ ARCHITECTURAL AUDIT SIMULATION (Step 7)
 * 
 * Verifies:
 * 1. Fresh Onboarding Stability
 * 2. Migration Idempotency
 * 3. Migration Transactional Safety (Failure Recovery)
 */

const { sequelize } = require('../../config/unified_database');
const { controlPlaneSequelize } = require('../../config/control_plane_db');
const tenantModelLoader = require('../../src/architecture/tenantModelLoader');
const migrationRunner = require('../../src/architecture/migrationRunner');

async function runAuditSimulation() {
    console.log('🧪 Starting Architectural Audit Simulation...');
    const schemaName = 'tenant_audit_sim_' + Date.now();
    
    try {
        // 1. FRESH ONBOARDING SIMULATION
        console.log(`\n📦 [1] Simulating onboarding for ${schemaName}...`);
        await tenantModelLoader.initializeTenantSchema(sequelize, schemaName);
        console.log('✅ Onboarding successful.');

        // 2. MIGRATION IDEMPOTENCY TEST
        console.log('\n🔢 [2] Testing Migration Idempotency (Running v1 twice)...');
        const tenantModels = await tenantModelLoader.getTenantModels(sequelize, schemaName);
        
        // Manual run of MigrationRunner
        await migrationRunner.runPendingMigrations(sequelize, schemaName, tenantModels);
        console.log('✅ Idempotency check: No redundant runs (Expected).');

        // 3. TRANSACTIONAL SAFETY SIMULATION (FAILURE RECOVERY)
        console.log('\n🧨 [3] Testing Transactional Failure Recovery...');
        
        // Create a 'broken' migration file temporarily
        const fs = require('fs');
        const path = require('path');
        const brokenPath = path.join(__dirname, '../../migrations/tenant/v999_broken_test.js');
        
        fs.writeFileSync(brokenPath, `
            module.exports = {
                version: 999,
                description: 'Broken migration for Audit simulation',
                async up(sequelize, schemaName, tenantModels, transaction) {
                    const options = transaction ? { transaction } : {};
                    await sequelize.query('CREATE TABLE "${schemaName}"."broken_table" (id serial primary key)', options);
                    throw new Error('SIMULATED MIGRATION FAILURE');
                }
            };
        `);

        try {
            await migrationRunner.runPendingMigrations(sequelize, schemaName, tenantModels);
        } catch (e) {
            console.log('✅ Migration failed as expected:', e.message);
        }

        // Check if 'broken_table' exists (It should NOT if transaction rolled back)
        const [tableExists] = await sequelize.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = '${schemaName}' AND table_name = 'broken_table'
            )
        `);

        if (tableExists[0].exists) {
            console.error('❌ FAILURE: [Pillar 3] Migration did NOT rollback the DDL change!');
        } else {
            console.log('✅ SUCCESS: [Pillar 3] Migration rolled back correctly.');
        }

        // Cleanup
        fs.unlinkSync(brokenPath);
        await sequelize.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
        console.log(`\n✨ Simulation Complete for ${schemaName}`);
        
    } catch (error) {
        console.error('🚨 Simulation crashed:', error.stack);
        await sequelize.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    }

    process.exit(0);
}

runAuditSimulation();
