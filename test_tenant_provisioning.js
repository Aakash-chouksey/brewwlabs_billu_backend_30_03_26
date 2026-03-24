require('dotenv').config();
const tenantProvisionService = require('./src/services/tenantProvisionService');

async function testTenantProvisioning() {
    console.log('🚀 Testing tenant provisioning...');
    
    try {
        const timestamp = Date.now();
        const result = await tenantProvisionService.provisionTenant({
            businessName: 'Test Business ' + timestamp,
            ownerEmail: `test-${timestamp}@example.com`,
            ownerUserId: '1dab2ef7-2201-4700-b7f8-05bb330e9463',
            planId: null,
            clusterId: null
        });
        
        console.log('✅ Tenant provisioning successful:', result);
        
        // Test the connection
        console.log('\n🔍 Testing tenant connection...');
        const connectionTest = await tenantProvisionService.testTenantConnection(result.businessId);
        console.log('Connection test result:', connectionTest);
        
        // Get tenant stats
        console.log('\n📊 Getting tenant stats...');
        const stats = await tenantProvisionService.getTenantStats(result.businessId);
        console.log('Tenant stats:', JSON.stringify(stats, null, 2));
        
    } catch (error) {
        console.error('❌ Tenant provisioning failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testTenantProvisioning();
