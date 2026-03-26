/**
 * GLOBAL SCHEMA REPAIR TOOL
 * 
 * Scalable repair for all tenant schemas.
 * Injects missing tables and missing columns for every model.
 */

const { sequelize } = require('../../config/unified_database');
const tenantModelLoader = require('../../src/architecture/tenantModelLoader');

async function repair() {
    console.log('🛠️ STARTING GLOBAL SCHEMA REPAIR...');
    const startTime = Date.now();
    
    try {
        // 1. Get all tenants from registry
        const [tenants] = await sequelize.query(`
            SELECT business_id, schema_name 
            FROM tenant_registry 
            WHERE status = 'active'
        `);
        
        console.log(`Found ${tenants.length} active tenants to check/repair.`);
        
        const results = [];
        let totalRepaired = 0;
        
        // 2. Repair each tenant
        for (const tenant of tenants) {
            console.log(`\n--- REPAIRING: ${tenant.schema_name} ---`);
            
            // First audit
            const reportBefore = await tenantModelLoader.verifySchemaIntegrity(sequelize, tenant.schema_name);
            
            if (reportBefore.isValid) {
                console.log(`   ✅ Healthy: Skipping ${tenant.schema_name}`);
                results.push({
                    business_id: tenant.business_id,
                    schema: tenant.schema_name,
                    status: 'SKIPPED',
                    issues_before: 0,
                    issues_after: 0
                });
                continue;
            }
            
            console.log(`   🚨 Drift detected (${reportBefore.issues} issues): Ingesting changes...`);
            
            // Repair
            const reportAfter = await tenantModelLoader.repairTenantSchema(sequelize, tenant.schema_name);
            
            results.push({
                business_id: tenant.business_id,
                schema: tenant.schema_name,
                status: reportAfter.isValid ? 'REPAIRED' : 'FAILED',
                issues_before: reportBefore.issues,
                issues_after: reportAfter.issues
            });
            
            if (reportAfter.isValid) totalRepaired++;
        }
        
        // 3. Output results
        console.log('\n--- REPAIR COMPLETE ---');
        console.table(results);
        
        console.log(`\n📊 SUMMARY:`);
        console.log(`   - Total Tenants Processed: ${tenants.length}`);
        console.log(`   - Repaired: ${totalRepaired}`);
        console.log(`   - Skipped (already ok): ${results.filter(r => r.status === 'SKIPPED').length}`);
        console.log(`   - Failed: ${results.filter(r => r.status === 'FAILED').length}`);
        console.log(`   - Duration: ${Date.now() - startTime}ms`);
        
    } catch (error) {
        console.error('❌ Repair failed:', error.message);
    } finally {
        process.exit();
    }
}

repair();
