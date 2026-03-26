/**
 * GLOBAL SCHEMA AUDIT TOOL
 * 
 * Scalable audit for all tenant schemas.
 * Detects missing tables and missing columns for every model.
 */

const { sequelize } = require('../../config/unified_database');
const tenantModelLoader = require('../../src/architecture/tenantModelLoader');

async function audit() {
    console.log('🔍 STARTING GLOBAL SCHEMA AUDIT...');
    const startTime = Date.now();
    
    try {
        // 1. Get all tenants from registry
        const [tenants] = await sequelize.query(`
            SELECT business_id, schema_name 
            FROM tenant_registry 
            WHERE status = 'active'
        `);
        
        console.log(`Found ${tenants.length} active tenants.`);
        
        const results = [];
        let totalIssues = 0;
        
        // 2. Audit each tenant
        for (const tenant of tenants) {
            const report = await tenantModelLoader.verifySchemaIntegrity(sequelize, tenant.schema_name);
            results.push({
                business_id: tenant.business_id,
                schema: tenant.schema_name,
                valid: report.isValid,
                issues: report.issues,
                missingTables: report.missingTables.join(', '),
                missingColumns: report.missingColumns.length > 5 
                    ? `${report.missingColumns.slice(0, 5).join(', ')}... (+${report.missingColumns.length - 5})`
                    : report.missingColumns.join(', ')
            });
            totalIssues += report.issues;
        }
        
        // 3. Output results
        console.log('\n--- SCAN COMPLETE ---');
        console.table(results);
        
        console.log(`\n📊 SUMMARY:`);
        console.log(`   - Total Tenants: ${tenants.length}`);
        console.log(`   - Healthy: ${results.filter(r => r.valid).length}`);
        console.log(`   - Drifted: ${results.filter(r => !r.valid).length}`);
        console.log(`   - Total Issues: ${totalIssues}`);
        console.log(`   - Duration: ${Date.now() - startTime}ms`);
        
        if (totalIssues > 0) {
            console.warn('\n🚨 DRIFT DETECTED: Run repair_all_tenants.js to fix.');
        } else {
            console.log('\n✅ ALL SYSTEMS NOMINAL: All schemas match the current models.');
        }
        
    } catch (error) {
        console.error('❌ Audit failed:', error.message);
    } finally {
        process.exit();
    }
}

audit();
