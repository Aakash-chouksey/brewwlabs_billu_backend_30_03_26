console.log('=== COMPREHENSIVE ONBOARDING TEST ===');

// Load environment variables
try {
    require('dotenv').config();
    console.log('✅ Environment variables loaded');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('DB_SYNC:', process.env.DB_SYNC);
} catch (error) {
    console.error('❌ Failed to load environment variables:', error.message);
    process.exit(1);
}

// Test database connections
async function testConnections() {
    console.log('\n=== TESTING DATABASE CONNECTIONS ===');
    
    // Test control plane connection
    try {
        const { controlPlaneSequelize } = require('../../config/control_plane_db');
        await controlPlaneSequelize.authenticate();
        console.log('✅ Control plane database connection successful');
        
        // Check if businesses table exists
        const [result] = await controlPlaneSequelize.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'businesses'
            );
        `);
        console.log('✅ Businesses table exists:', result.rows[0].exists);
        
    } catch (error) {
        console.error('❌ Control plane connection failed:', error.message);
    }
    
    // Test tenant connection factory
    try {
        const tenantConnectionFactory = require('../../src/services/tenantConnectionFactory');
        console.log('✅ Tenant connection factory loaded');
        
        // Test creating a tenant database directly
        const { Client } = require('pg');
        const client = new Client({
            host: 'localhost',
            port: 5432,
            user: 'postgres',
            password: 'password',
            database: 'postgres'
        });
        
        await client.connect();
        console.log('✅ Direct PostgreSQL connection successful');
        await client.end();
        
    } catch (error) {
        console.error('❌ Tenant connection test failed:', error.message);
    }
}

// Test onboarding service
async function testOnboarding() {
    console.log('\n=== TESTING ONBOARDING SERVICE ===');
    
    try {
        const onboardingService = require('../../services/onboarding.service');
        console.log('✅ Onboarding service loaded');
        
        const testData = {
            businessName: 'Test Cafe ' + Date.now(),
            businessEmail: 'test' + Date.now() + '@cafe.com',
            businessPhone: '+1234567890',
            businessAddress: '123 Test Street',
            gstNumber: '123456789012345',
            adminName: 'Test Admin',
            adminEmail: 'admin' + Date.now() + '@cafe.com',
            adminPassword: 'Password123!',
            cafeType: 'SOLO'
        };
        
        console.log('🚀 Starting onboarding test...');
        console.log('Test data:', {
            businessName: testData.businessName,
            businessEmail: testData.businessEmail
        });
        
        const result = await onboardingService.onboardBusiness(testData);
        
        console.log('✅ Onboarding successful!');
        console.log('Result:', {
            businessId: result.businessId,
            databaseName: result.databaseName,
            outletId: result.outletId
        });
        
    } catch (error) {
        console.error('❌ Onboarding failed:', error.message);
        console.error('Error details:', {
            name: error.name,
            stack: error.stack?.split('\n').slice(0, 5).join('\n')
        });
    }
}

// Run all tests
async function runAllTests() {
    try {
        await testConnections();
        await testOnboarding();
        console.log('\n=== TEST COMPLETED ===');
    } catch (error) {
        console.error('❌ Test suite failed:', error.message);
    }
}

runAllTests();
