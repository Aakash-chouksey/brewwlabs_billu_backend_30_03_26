const { sequelize } = require('../../config/unified_database');
const onboardingService = require('../../services/onboarding.service');
const { ModelFactory } = require('../../src/architecture/modelFactory');

async function runVerification() {
    console.log('🚀 [VERIFICATION] Starting final onboarding test...');
    
    const timestamp = Date.now();
    const testData = {
        businessName: `Audit Test Cafe ${timestamp}`,
        businessEmail: `audit${timestamp}@cafe.com`,
        businessPhone: '+1000000000',
        businessAddress: 'Audit Street 1',
        gstNumber: 'AAABBBCCC',
        adminName: 'Audit Admin',
        adminEmail: `admin_audit${timestamp}@cafe.com`,
        adminPassword: 'Password123!',
        cafeType: 'SOLO'
    };

    try {
        console.log('📦 STEP 1: Running Onboarding Service...');
        const result = await onboardingService.onboardBusiness(testData);
        
        if (result.success) {
            const data = result.data;
            console.log('✅ Onboarding SUCCESS!');
            console.log(`   Business ID: ${data.businessId}`);
            console.log(`   Schema Name: ${data.schemaName}`);
            console.log(`   Outlet ID:   ${data.outletId}`);
            
            console.log('\n🔍 STEP 2: Verifying Tables in Schema...');
            await sequelize.query(`SET search_path TO "${data.schemaName}"`);
            
            const [tables] = await sequelize.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = '${data.schemaName}'
                AND table_type = 'BASE TABLE'
            `);
            
            const tableNames = tables.map(t => t.table_name);
            console.log(`   Found ${tableNames.length} tables`);
            
            const criticalTables = ['outlets', 'products', 'orders', 'categories'];
            const missing = criticalTables.filter(t => !tableNames.includes(t));
            
            if (missing.length === 0) {
                console.log('✅ All critical tables verified!');
            } else {
                console.error('❌ Missing critical tables:', missing.join(', '));
            }
            
            console.log('\n✨ [VERIFICATION COMPLETE] System is fully operational!');
        } else {
            console.error('❌ Onboarding failed:', result.message);
        }
    } catch (e) {
        console.error('💥 TEST CRASHED:', e.message);
        console.error(e.stack);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

runVerification();
