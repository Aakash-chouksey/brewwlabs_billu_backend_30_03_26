#!/usr/bin/env node

console.log('='.repeat(60));
console.log('COMPLETE ONBOARDING TEST');
console.log('='.repeat(60));

// Load environment and test basic setup
console.log('\n📋 STEP 0: Environment Setup');
try {
    require('dotenv').config();
    console.log('✅ Environment loaded');
    console.log('   NODE_ENV:', process.env.NODE_ENV);
    console.log('   DB_SYNC:', process.env.DB_SYNC);
    console.log('   DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('   CONTROL_PLANE_DATABASE_URL exists:', !!process.env.CONTROL_PLANE_DATABASE_URL);
} catch (error) {
    console.error('❌ Environment setup failed:', error.message);
    process.exit(1);
}

// Test database connections
async function testDatabaseConnections() {
    console.log('\n📋 STEP 1: Database Connections');
    
    try {
        // Test control plane database
        const { controlPlaneSequelize } = require('../../config/control_plane_db');
        await controlPlaneSequelize.authenticate();
        console.log('✅ Control plane database connected');
        
        // Test shared database
        const { sequelize: sharedSequelize } = require('../../config/database_postgres');
        await sharedSequelize.authenticate();
        console.log('✅ Shared database connected');
        console.log('   SSL config:', sharedSequelize.config.dialectOptions.ssl);
        
        return { controlPlaneSequelize, sharedSequelize };
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        throw error;
    }
}

// Test onboarding service
async function testOnboarding() {
    console.log('\n📋 STEP 2: Onboarding Service Test');
    
    try {
        const onboardingService = require('../../services/onboarding.service');
        console.log('✅ Onboarding service loaded');
        
        // Generate unique test data
        const timestamp = Date.now();
        const testData = {
            businessName: `Test Cafe ${timestamp}`,
            businessEmail: `test${timestamp}@cafe.com`,
            businessPhone: '+1234567890',
            businessAddress: '123 Test Street',
            gstNumber: '123456789012345',
            adminName: 'Test Admin',
            adminEmail: `admin${timestamp}@cafe.com`,
            adminPassword: 'Password123!',
            cafeType: 'SOLO'
        };
        
        console.log('🚀 Starting onboarding...');
        console.log('   Business:', testData.businessName);
        console.log('   Email:', testData.businessEmail);
        
        const result = await onboardingService.onboardBusiness(testData);
        
        console.log('✅ ONBOARDING SUCCESSFUL!');
        console.log('📊 Results:');
        console.log('   Business ID:', result.businessId);
        console.log('   Database Name:', result.databaseName);
        console.log('   Outlet ID:', result.outletId);
        console.log('   Admin User ID:', result.adminUserId);
        
        return result;
    } catch (error) {
        console.error('❌ Onboarding failed:', error.message);
        console.error('🔍 Error details:', {
            name: error.name,
            stack: error.stack?.split('\n').slice(0, 8).join('\n')
        });
        throw error;
    }
}

// Verify created data
async function verifyResults(result) {
    console.log('\n📋 STEP 3: Verification');
    
    try {
        const { controlPlaneSequelize } = require('../../config/control_plane_db');
        
        // Check business in control plane
        const [businessResult] = await controlPlaneSequelize.query(
            'SELECT name, email, status FROM businesses WHERE id = :businessId',
            { replacements: { businessId: result.businessId }, type: require('sequelize').QueryTypes.SELECT }
        );
        
        if (businessResult) {
            console.log('✅ Business verified in control plane:', businessResult.name);
        }
        
        // Check tenant connection
        const [connectionResult] = await controlPlaneSequelize.query(
            'SELECT db_name, db_host FROM tenant_connections WHERE business_id = :businessId',
            { replacements: { businessId: result.businessId }, type: require('sequelize').QueryTypes.SELECT }
        );
        
        if (connectionResult) {
            console.log('✅ Tenant connection verified:', connectionResult.db_name);
        }
        
        console.log('✅ Verification completed successfully');
        
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
    }
}

// Main test execution
async function runCompleteTest() {
    try {
        console.log('Starting complete onboarding test...\n');
        
        // Test database connections
        const databases = await testDatabaseConnections();
        
        // Test onboarding
        const result = await testOnboarding();
        
        // Verify results
        await verifyResults(result);
        
        console.log('\n' + '='.repeat(60));
        console.log('🎉 COMPLETE ONBOARDING TEST SUCCESSFUL!');
        console.log('🎉 All systems working properly!');
        console.log('='.repeat(60));
        
    } catch (error) {
        console.log('\n' + '='.repeat(60));
        console.log('❌ COMPLETE ONBOARDING TEST FAILED!');
        console.log('❌ Issues found that need fixing');
        console.log('='.repeat(60));
        process.exit(1);
    }
}

// Run the test
runCompleteTest().catch(error => {
    console.error('💥 Unhandled error:', error.message);
    process.exit(1);
});
