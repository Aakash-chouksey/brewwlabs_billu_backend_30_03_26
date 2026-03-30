const Sequelize = require('sequelize');
const { sequelize } = require('../config/unified_database');
const { TENANT_SCHEMA_PREFIX, TENANT_MODELS } = require('../src/utils/constants');
const tenantModelLoader = require('../src/architecture/tenantModelLoader');
const tenantMigrationService = require('../services/tenantMigrationService');

async function auditTenantSchemas(repair = false) {
    console.log(`[Audit] 🔍 Starting tenant schema audit... (Repair mode: ${repair})`);
    
    // 1. Get all active tenants
    const tenants = await sequelize.query(
        `SELECT id, business_id, schema_name, status FROM "public"."tenant_registry"`,
        { type: Sequelize.QueryTypes.SELECT }
    );

    console.log(`[Audit] Found ${tenants.length} tenants in registry.`);
    
    const overallReport = {
        totalTenants: tenants.length,
        validTenants: 0,
        invalidTenants: 0,
        repairedTenants: 0,
        issues: []
    };

    for (const tenant of tenants) {
        const { business_id: businessId, schema_name: schemaName } = tenant;
        console.log(`[Audit] Checking tenant: ${businessId} (${schemaName})...`);

        try {
            // Verify schema exists
            const schemaCheck = await sequelize.query(
                `SELECT schema_name FROM information_schema.schemata WHERE schema_name = :schema`,
                { replacements: { schema: schemaName }, type: Sequelize.QueryTypes.SELECT }
            );

            if (schemaCheck.length === 0) {
                console.error(`[Audit] ❌ Schema ${schemaName} does NOT exist!`);
                overallReport.issues.push({ businessId, schemaName, issue: 'SCHEMA_MISSING' });
                overallReport.invalidTenants++;
                continue;
            }

            // Run integrity check using ModelLoader
            const report = await tenantModelLoader.verifySchemaIntegrity(sequelize, schemaName);
            
            if (report.isValid) {
                console.log(`[Audit] ✅ Tenant ${schemaName} is valid.`);
                overallReport.validTenants++;
            } else {
                console.warn(`[Audit] ⚠️ Tenant ${schemaName} has ${report.issues} issues.`);
                console.log(`[Audit]   - Missing tables: ${report.missingTables.join(', ') || 'None'}`);
                console.log(`[Audit]   - Missing columns: ${report.missingColumns.join(', ') || 'None'}`);
                
                overallReport.issues.push({ 
                    businessId, 
                    schemaName, 
                    issue: 'MISMATCH', 
                    missingTables: report.missingTables,
                    missingColumns: report.missingColumns
                });
                overallReport.invalidTenants++;

                if (repair) {
                    console.log(`[Audit] 🛠️ Attempting repair for ${schemaName}...`);
                    try {
                        const repairResult = await tenantMigrationService.runPendingMigrations(businessId);
                        if (repairResult.data.migrationsRun > 0) {
                            console.log(`[Audit] ✅ Repaired ${schemaName} by running ${repairResult.data.migrationsRun} migrations.`);
                            overallReport.repairedTenants++;
                        } else {
                            console.warn(`[Audit] ⚠️ Repair attempted but no pending migrations found for ${schemaName}. Manual fix may be required.`);
                        }
                    } catch (err) {
                        console.error(`[Audit] ❌ Repair FAILED for ${schemaName}:`, err.message);
                    }
                }
            }
        } catch (error) {
            console.error(`[Audit] ❌ Error auditing ${schemaName}:`, error.message);
            overallReport.issues.push({ businessId, schemaName, issue: 'ERROR', message: error.message });
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('AUDIT SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total Tenants Checked: ${overallReport.totalTenants}`);
    console.log(`Valid Tenants: ${overallReport.validTenants}`);
    console.log(`Invalid Tenants: ${overallReport.invalidTenants}`);
    if (repair) console.log(`Repaired Tenants: ${overallReport.repairedTenants}`);
    console.log('='.repeat(50));

    if (overallReport.issues.length > 0) {
        console.log('\nDETAILED ISSUES:');
        console.table(overallReport.issues);
    }

    return overallReport;
}

// CLI entry point
const args = process.argv.slice(2);
const repairMode = args.includes('--repair');

auditTenantSchemas(repairMode)
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Fatal Audit Error:', err);
        process.exit(1);
    });
