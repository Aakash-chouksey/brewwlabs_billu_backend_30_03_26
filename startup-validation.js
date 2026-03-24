
const { validateControlPlane } = require('./config/database_postgres');
const { ControlPlaneModels } = require('./src/controlPlane');

async function strictStartupValidation() {
    console.log('🔒 STRICT STARTUP VALIDATION...');
    
    const isProduction = process.env.NODE_ENV === 'production';
    
    try {
        // 1. Validate control plane DB connection
        console.log('📡 Validating control plane database...');
        await validateControlPlane();
        console.log('✅ Control plane database validated');
        
        // 2. Validate critical control plane models
        console.log('🏗️  Validating control plane models...');
        const { User, Business, TenantConnection } = ControlPlaneModels;
        
        // Test model access
        await User.findOne({ limit: 1 });
        await Business.findOne({ limit: 1 });
        await TenantConnection.findOne({ limit: 1 });
        console.log('✅ Control plane models validated');
        
        // 3. Validate tenant_connections table exists
        console.log('🔗 Validating tenant connections table...');
        const connectionCount = await TenantConnection.count();
        console.log(`✅ Tenant connections table exists (${connectionCount} connections)`);
        
        console.log('🎉 STARTUP VALIDATION PASSED - Server starting...');
        
    } catch (error) {
        console.error('💥 STARTUP VALIDATION FAILED:');
        console.error('   Error:', error.message);
        
        if (isProduction) {
            console.error('\n🚨 PRODUCTION MODE - ABORTING STARTUP');
            console.error('   Server will NOT bind to port until validation passes');
            process.exit(1);
        } else {
            console.error('\n⚠️  DEVELOPMENT MODE - Continuing with warnings');
            console.error('   Fix validation issues before production deployment');
        }
    }
}

module.exports = { strictStartupValidation };
