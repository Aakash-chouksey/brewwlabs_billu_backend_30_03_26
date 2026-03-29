#!/usr/bin/env node
/**
 * TENANT RECOVERY SCRIPT
 * 
 * Recovers tenants stuck in INIT_FAILED status
 * Usage: node scripts/recover-failed-tenants.js [business_id]
 * 
 * If business_id provided: recovers specific tenant
 * If no business_id: lists all failed tenants
 */

const { sequelize } = require('../config/unified_database');
const onboardingService = require('../services/onboardingService');

async function listFailedTenants() {
    console.log('🔍 Checking for failed tenants...\n');
    
    const failedTenants = await sequelize.query(`
        SELECT 
            tr.business_id,
            tr.schema_name,
            tr.status,
            tr.last_error,
            tr.retry_count,
            tr.created_at,
            b.name as business_name,
            b.email as business_email
        FROM public.tenant_registry tr
        JOIN public.businesses b ON b.id = tr.business_id
        WHERE tr.status = 'INIT_FAILED'
        ORDER BY tr.created_at DESC
    `, { type: sequelize.QueryTypes.SELECT });
    
    if (failedTenants.length === 0) {
        console.log('✅ No failed tenants found!');
        return [];
    }
    
    console.log(`🚨 Found ${failedTenants.length} failed tenant(s):\n`);
    
    for (const tenant of failedTenants) {
        console.log(`  📌 Business: ${tenant.business_name} (${tenant.business_email})`);
        console.log(`     ID: ${tenant.business_id}`);
        console.log(`     Schema: ${tenant.schema_name}`);
        console.log(`     Retry Count: ${tenant.retry_count}`);
        console.log(`     Created: ${tenant.created_at}`);
        console.log(`     Last Error: ${tenant.last_error || 'N/A'}`);
        console.log();
    }
    
    return failedTenants;
}

async function recoverTenant(businessId) {
    console.log(`🔄 Starting recovery for tenant: ${businessId}\n`);
    
    const schemaName = `tenant_${businessId}`;
    
    // 1. Check tenant exists and is in failed state
    const tenant = await sequelize.query(`
        SELECT * FROM public.tenant_registry 
        WHERE business_id = :businessId
    `, { 
        replacements: { businessId }, 
        type: sequelize.QueryTypes.SELECT 
    });
    
    if (tenant.length === 0) {
        console.error(`❌ Tenant ${businessId} not found in registry`);
        process.exit(1);
    }
    
    const tenantData = tenant[0];
    console.log(`  Current Status: ${tenantData.status}`);
    console.log(`  Schema: ${tenantData.schema_name}`);
    console.log(`  Last Error: ${tenantData.last_error || 'N/A'}`);
    console.log();
    
    if (tenantData.status !== 'INIT_FAILED') {
        console.warn(`⚠️  Tenant status is ${tenantData.status}, not INIT_FAILED`);
        console.log('   Recovery is only for failed tenants. Use normal onboarding for new tenants.');
    }
    
    // 2. Check if schema exists
    const schemaCheck = await sequelize.query(`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name = :schema
    `, { 
        replacements: { schema: schemaName }, 
        type: sequelize.QueryTypes.SELECT 
    });
    
    const schemaExists = schemaCheck.length > 0;
    console.log(`  Schema Exists: ${schemaExists ? '✅ Yes' : '❌ No'}`);
    
    // 3. Check tables in schema
    let tableCount = 0;
    if (schemaExists) {
        const tables = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = :schema AND table_type = 'BASE TABLE'
        `, { 
            replacements: { schema: schemaName }, 
            type: sequelize.QueryTypes.SELECT 
        });
        tableCount = tables.length;
        console.log(`  Tables Found: ${tableCount}`);
        
        if (tableCount > 0) {
            console.log(`    Tables: ${tables.map(t => t.table_name).join(', ')}`);
        }
    }
    console.log();
    
    // 4. Ask for confirmation
    console.log('🔔 Recovery will:');
    if (!schemaExists || tableCount === 0) {
        console.log('   - Drop existing schema (if any)');
        console.log('   - Recreate schema from scratch');
        console.log('   - Run all migrations');
    } else {
        console.log('   - Keep existing schema');
        console.log('   - Run missing migrations');
    }
    console.log('   - Reset retry count');
    console.log('   - Attempt to activate tenant\n');
    
    // Auto-confirm for script usage
    console.log('⏳ Starting recovery in 3 seconds...');
    await new Promise(r => setTimeout(r, 3000));
    
    // 5. Perform recovery
    try {
        // Reset retry count
        await sequelize.query(`
            UPDATE public.tenant_registry 
            SET retry_count = 0, last_error = NULL
            WHERE business_id = :businessId
        `, { replacements: { businessId } });
        
        console.log('✅ Reset retry count\n');
        
        // Trigger background migration
        console.log('🚀 Triggering background migration...');
        const result = await onboardingService._runBackgroundMigrations(schemaName, businessId, 3);
        
        if (result.success) {
            console.log(`\n✅ RECOVERY SUCCESSFUL!`);
            console.log(`   Duration: ${result.duration}ms`);
            
            // Verify final status
            const finalCheck = await sequelize.query(`
                SELECT status FROM public.tenant_registry 
                WHERE business_id = :businessId
            `, { 
                replacements: { businessId }, 
                type: sequelize.QueryTypes.SELECT 
            });
            
            console.log(`   Final Status: ${finalCheck[0]?.status}`);
            console.log(`\n🎉 Tenant ${businessId} is now ready for use!`);
        } else {
            console.log(`\n❌ RECOVERY FAILED`);
            console.log(`   Error: ${result.error}`);
            console.log(`\n💡 Check logs for details. Tenant may need manual intervention.`);
        }
        
    } catch (error) {
        console.error(`\n🚨 RECOVERY ERROR: ${error.message}`);
        console.error(error.stack);
    }
}

async function main() {
    const businessId = process.argv[2];
    
    try {
        console.log('🔌 Connecting to database...');
        await sequelize.authenticate();
        console.log('✅ Database connected\n');
        
        if (businessId) {
            await recoverTenant(businessId);
        } else {
            const failed = await listFailedTenants();
            if (failed.length > 0) {
                console.log('💡 To recover a specific tenant, run:');
                console.log(`   node scripts/recover-failed-tenants.js <business_id>`);
                console.log();
                console.log('   Example:');
                console.log(`   node scripts/recover-failed-tenants.js ${failed[0].business_id}`);
            }
        }
        
    } catch (error) {
        console.error('🚨 Fatal Error:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
        console.log('\n🔌 Database connection closed');
    }
}

main();
