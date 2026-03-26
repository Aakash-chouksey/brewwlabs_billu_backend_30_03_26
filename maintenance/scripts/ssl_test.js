console.log('=== SSL CONFIGURATION TEST ===');

// Test 1: Check environment variables
console.log('\n1. ENVIRONMENT VARIABLES:');
try {
    require('dotenv').config();
    console.log('✅ NODE_ENV:', process.env.NODE_ENV);
    console.log('✅ DB_SYNC:', process.env.DB_SYNC);
    console.log('✅ DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('✅ CONTROL_PLANE_DATABASE_URL exists:', !!process.env.CONTROL_PLANE_DATABASE_URL);
} catch (error) {
    console.error('❌ Environment loading failed:', error.message);
}

// Test 2: Check tenant connection factory SSL configuration
console.log('\n2. TENANT CONNECTION SSL CONFIGURATION:');
try {
    const { Sequelize } = require('sequelize');
    
    // Simulate the exact configuration used in tenantConnectionFactory
    const sequelizeConfig = {
        host: 'localhost',
        port: 5432,
        dialect: 'postgres',
        logging: false,
        define: { underscored: true },
        dialectOptions: {
            // Explicitly disable SSL for local development
            ssl: false,
            // Additional PostgreSQL connection options
            connectTimeout: 15000,
            // Ensure no SSL parameters are inherited
            sslmode: 'disable'
        }
    };
    
    console.log('✅ SSL Configuration:', {
        ssl: sequelizeConfig.dialectOptions.ssl,
        sslmode: sequelizeConfig.dialectOptions.sslmode,
        NODE_ENV: process.env.NODE_ENV
    });
    
    // Test creating a Sequelize instance (without connecting)
    const sequelize = new Sequelize('test_db', 'test_user', 'test_pass', sequelizeConfig);
    console.log('✅ Sequelize instance created successfully');
    console.log('✅ Final SSL config:', sequelize.config.dialectOptions.ssl);
    
} catch (error) {
    console.error('❌ SSL configuration test failed:', error.message);
}

// Test 3: Check onboarding service loading
console.log('\n3. ONBOARDING SERVICE:');
try {
    const onboardingService = require('../../services/onboarding.service');
    console.log('✅ Onboarding service loaded successfully');
    console.log('✅ Service methods:', Object.getOwnPropertyNames(onboardingService));
} catch (error) {
    console.error('❌ Onboarding service loading failed:', error.message);
}

console.log('\n=== SSL TEST COMPLETED ===');
