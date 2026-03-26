const fs = require('fs');

// Create a log file to capture output
const logFile = fs.createWriteStream('onboarding_test.log', { flags: 'w' });
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = (...args) => {
    originalConsoleLog(...args);
    logFile.write(args.join(' ') + '\n');
};

console.error = (...args) => {
    originalConsoleError(...args);
    logFile.write('ERROR: ' + args.join(' ') + '\n');
};

async function runTest() {
    try {
        console.log('=== SSL ISSUE DEBUG TEST ===');
        
        // Load environment
        require('dotenv').config();
        console.log('Environment loaded');
        console.log('NODE_ENV:', process.env.NODE_ENV);
        console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
        
        // Test shared database connection
        console.log('\nTesting shared database connection...');
        const { sequelize: sharedSequelize } = require('../../config/database_postgres');
        console.log('Shared sequelize loaded');
        console.log('SSL config:', JSON.stringify(sharedSequelize.config.dialectOptions.ssl));
        
        try {
            await sharedSequelize.authenticate();
            console.log('✅ Shared database connection successful');
        } catch (error) {
            console.error('❌ Shared database connection failed:', error.message);
            console.error('Error details:', error.stack);
            throw error;
        }
        
        // Test control plane connection
        console.log('\nTesting control plane connection...');
        const { controlPlaneSequelize } = require('../../config/control_plane_db');
        console.log('Control plane sequelize loaded');
        
        try {
            await controlPlaneSequelize.authenticate();
            console.log('✅ Control plane connection successful');
        } catch (error) {
            console.error('❌ Control plane connection failed:', error.message);
            throw error;
        }
        
        // Test onboarding service
        console.log('\nTesting onboarding service...');
        const onboardingService = require('../../services/onboarding.service');
        console.log('Onboarding service loaded');
        
        // Simple test data
        const testData = {
            businessName: 'Debug Test ' + Date.now(),
            businessEmail: 'debug' + Date.now() + '@test.com',
            businessPhone: '+1234567890',
            businessAddress: '123 Test Street',
            gstNumber: '123456789012345',
            adminName: 'Debug Admin',
            adminEmail: 'debugadmin' + Date.now() + '@test.com',
            adminPassword: 'Password123!',
            cafeType: 'SOLO'
        };
        
        console.log('Starting onboarding test...');
        const result = await onboardingService.onboardBusiness(testData);
        
        console.log('✅ ONBOARDING SUCCESSFUL!');
        console.log('Result:', JSON.stringify(result, null, 2));
        
    } catch (error) {
        console.error('💥 TEST FAILED:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        // Restore console
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
        logFile.end();
    }
}

runTest();
