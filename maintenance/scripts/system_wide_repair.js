/**
 * SYSTEM-WIDE SCHEMA REPAIR TOOL
 * 
 * Transition all tenants to a 100% Data-First state by:
 * 1. Scanning the Tenant Registry
 * 2. Running column-level integrity checks
 * 3. Automatically repairing drift using model.sync({alter: true})
 * 
 * 🛡️ REPLACES: All manual ALTER TABLE scripts in maintenance/scripts/
 */

require('dotenv').config({ override: true });
const { sequelize } = require('../../config/unified_database');
const { controlPlaneSequelize } = require('../../config/control_plane_db');
const tenantModelLoader = require('../../src/architecture/tenantModelLoader');
const { DataTypes } = require('sequelize');

async function runRepair() {
    const startTime = Date.now();
    console.log('🚀 INITIALIZING SYSTEM-WIDE SCHEMA REPAIR...');

    try {
        // 1. Define Registry Model for this session
        const TenantRegistry = controlPlaneSequelize.define('TenantRegistry', {
            id: { type: DataTypes.UUID, primaryKey: true },
            businessId: { type: DataTypes.UUID, field: 'business_id' },
            schemaName: { type: DataTypes.STRING, field: 'schema_name' },
            status: { type: DataTypes.STRING }
        }, {
            tableName: 'tenant_registry',
            schema: 'public',
            timestamps: false
        });

        // 2. Fetch all tenants that need schema maintenance
        const tenants = await TenantRegistry.findAll({
            where: { status: 'active' }
        });

        console.log(`🔍 Found ${tenants.length} active tenants to verify.`);

        const reports = [];
        let totalIssues = 0;

        for (const tenant of tenants) {
            const schemaName = tenant.schemaName;
            console.log(`\n---------------------------------------------------------`);
            console.log(`🛠️  REPAIRING: ${schemaName} (Business: ${tenant.businessId})`);
            
            try {
                // A. Initial Integrity Check
                const initialCheck = await tenantModelLoader.verifySchemaIntegrity(sequelize, schemaName);
                
                if (initialCheck.isValid) {
                    console.log(`  ✅ ${schemaName} is already 100% aligned with models.`);
                    reports.push({ schemaName, status: 'ALIGNED', issues: 0 });
                    continue;
                }

                console.log(`  🔴 ${schemaName} drifted! Issues found: ${initialCheck.issues}`);
                console.log(`     Missing Tables: ${initialCheck.missingTables.join(', ') || 'None'}`);
                console.log(`     Missing Columns: ${initialCheck.missingColumns.length} fields detected.`);

                // B. EXECUTE REPAIR (Data-First model.sync)
                console.log(`  ⚡ Executing auto-repair for ${schemaName}...`);
                const repairResult = await tenantModelLoader.repairTenantSchema(sequelize, schemaName);
                
                if (repairResult.isValid) {
                    console.log(`  ✨ ${schemaName} successfully repaired and aligned.`);
                    reports.push({ schemaName, status: 'REPAIRED', issues: initialCheck.issues });
                    totalIssues += initialCheck.issues;
                } else {
                    console.error(`  ❌ ${schemaName} repair partial. Remaining issues: ${repairResult.issues}`);
                    reports.push({ schemaName, status: 'PARTIAL_REPAIR', issues: repairResult.issues });
                    totalIssues += repairResult.issues;
                }

            } catch (err) {
                console.error(`  🚨 CRITICAL ERROR in ${schemaName}:`, err.message);
                reports.push({ schemaName, status: 'FAILED', error: err.message });
            }
        }

        // 3. FINAL SUMMARY
        const duration = (Date.now() - startTime) / 1000;
        console.log(`\n=========================================================`);
        console.log(`🏁 REPAIR CYCLE COMPLETE in ${duration.toFixed(1)}s`);
        console.log(`📊 Summary:`);
        console.log(`   - Total Tenants: ${tenants.length}`);
        console.log(`   - Repaired: ${reports.filter(r => r.status === 'REPAIRED').length}`);
        console.log(`   - Aligned: ${reports.filter(r => r.status === 'ALIGNED').length}`);
        console.log(`   - Errors/Partial: ${reports.filter(r => ['FAILED', 'PARTIAL_REPAIR'].includes(r.status)).length}`);
        console.log(`   - Total Schema Flaws Corrected: ${totalIssues}`);
        console.log(`=========================================================\n`);

    } catch (error) {
        console.error('❌ SYSTEM REPAIR FAILED:', error.message);
    } finally {
        process.exit(0);
    }
}

runRepair();
