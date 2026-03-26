require('dotenv').config();

async function testTenantFactory() {
    try {
        console.log('🔍 Testing tenant connection factory...');
        
        const tenantConnectionFactory = require('../../src/services/tenantConnectionFactory');
        
        // Test with a sample business ID
        const sampleBusinessId = '12345678-1234-1234-1234-123456789012';
        
        console.log('🔧 Getting connection for business:', sampleBusinessId);
        
        try {
            const sequelize = await tenantConnectionFactory.getConnection(sampleBusinessId);
            console.log('✅ Tenant connection successful');
            await sequelize.close();
        } catch (error) {
            console.log('❌ Expected error for non-existent business:', error.message);
        }
        
        console.log('✅ Tenant factory test completed');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testTenantFactory();
