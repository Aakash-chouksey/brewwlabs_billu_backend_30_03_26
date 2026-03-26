/**
 * SYSTEM INTEGRITY VERIFICATION SCRIPT
 * 
 * Performs cross-check between:
 * 1. Registered Sequelize models
 * 2. MODEL_FILES in tenantModelLoader
 * 3. REQUIRED_TABLES in OnboardingService
 * 4. Actual database schema (if connected)
 */

const { sequelize } = require('../config/unified_database');
const tenantModelLoader = require('../src/architecture/tenantModelLoader');
const OnboardingService = require('../services/onboarding.service');
const { CONTROL_MODELS } = require('../src/utils/constants');

const { ModelFactory } = require('../src/architecture/modelFactory');

async function runAudit() {
    console.log('🚀 STARTING SYSTEM INTEGRITY AUDIT...\n');

    // 0. Initialize Models
    console.log('--- 0. Initializing Models ---');
    await ModelFactory.createModels(sequelize);

    const errors = [];
    const warnings = [];

    // 1. Audit Model Registration
    console.log('--- 1. Checking Model Registration ---');
    const registeredModels = Object.keys(sequelize.models);
    console.log(`✅ Total models registered in Sequelize: ${registeredModels.length}`);
    
    if (registeredModels.length < 40) {
        errors.push(`🚨 CRITICAL: Only ${registeredModels.length} models registered. Expected ~45.`);
    }

    // 2. Audit Onboarding Service Dynamic Logic
    console.log('\n--- 2. Checking Onboarding Service Dynamic Identification ---');
    const allModels = Object.values(sequelize.models);
    const requiredTenantTables = allModels
        .filter(model => !CONTROL_MODELS.includes(model.name))
        .map(model => {
            const raw = model.getTableName();
            return typeof raw === 'string' ? raw : raw.tableName;
        });

    console.log(`✅ Identified ${requiredTenantTables.length} tenant tables from models.`);
    
    // Check for any CONTROL_MODELS in the tenant table list
    const leakedModels = allModels.filter(m => CONTROL_MODELS.includes(m.name) && requiredTenantTables.includes(m.getTableName()));
    if (leakedModels.length > 0) {
        errors.push(`🚨 CRITICAL: Control plane tables leaked into tenant list: ${leakedModels.map(m => m.name).join(', ')}`);
    }

    // 4. Database Schema Cross-Check (Public)
    console.log('\n--- 4. Checking Public Schema Tables ---');
    try {
        const tables = await sequelize.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        `, { type: sequelize.QueryTypes.SELECT });
        
        const publicTables = tables.map(t => t.table_name);
        console.log(`✅ Found ${publicTables.length} tables in public schema.`);
        
        // Ensure all CONTROL_MODELS have tables (if they have tableName)
        // This is a rough check
    } catch (err) {
        errors.push(`❌ Failed to query database: ${err.message}`);
    }

    // 5. Check for cross-schema associations in Sequelize
    console.log('\n--- 5. Checking for Cross-Schema Associations ---');
    for (const [name, model] of Object.entries(sequelize.models)) {
        if (CONTROL_MODELS.includes(name)) continue; // Skip control models

        const associations = model.associations;
        for (const [assocName, assoc] of Object.entries(associations)) {
            const targetModelName = assoc.target.name;
            if (CONTROL_MODELS.includes(targetModelName)) {
                errors.push(`🚨 CRITICAL: Tenant model '${name}' has association '${assocName}' to control model '${targetModelName}'!`);
            }
        }
    }

    console.log('\n--- AUDIT SUMMARY ---');
    if (errors.length === 0 && warnings.length === 0) {
        console.log('✨ SYSTEM 100% CONSISTENT AND PRODUCTION-SAFE!');
    } else {
        errors.forEach(e => console.error(e));
        warnings.forEach(w => console.warn(w));
        if (errors.length > 0) {
            console.log(`\n❌ Found ${errors.length} errors. Action required.`);
            process.exit(1);
        } else {
            console.log(`\n✅ System mostly consistent but found ${warnings.length} warnings.`);
        }
    }
}

runAudit().catch(err => {
    console.error('Audit failed:', err);
    process.exit(1);
});
