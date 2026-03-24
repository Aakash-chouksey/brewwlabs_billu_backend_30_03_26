#!/usr/bin/env node

/**
 * Dashboard API Verification Script
 * Tests that the Op.col fix works for new user onboarding
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Test Configuration
const TEST_CONFIG = {
    adminLogin: {
        email: 'admin@brewwlabs.com',
        password: 'admin123'
    },
    testUser: {
        businessName: 'Test Dashboard Business',
        businessEmail: 'testdashboard@example.com',
        businessPhone: '+1234567890',
        cafeType: 'cafe'
    }
};

// Colors for output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    bold: '\x1b[1m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
    log(`\n${colors.bold}STEP ${step}:${colors.reset} ${message}`, colors.blue);
}

function logSuccess(message) {
    log(`✅ ${message}`, colors.green);
}

function logError(message) {
    log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
    log(`⚠️  ${message}`, colors.yellow);
}

// Create axios instance
const createApi = (token) => {
    return axios.create({
        baseURL: BASE_URL,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
};

// Test functions
const testAdminLogin = async () => {
    logStep(1, 'Testing Admin Login');
    try {
        const response = await axios.post(`${BASE_URL}/api/admin/login`, TEST_CONFIG.adminLogin);
        
        if (response.data.success && response.data.data.accessToken) {
            logSuccess('Admin login successful');
            return response.data.data.accessToken;
        } else {
            logError('Admin login failed');
            return null;
        }
    } catch (error) {
        logError(`Admin login error: ${error.message}`);
        return null;
    }
};

const testSalesDashboard = async (api, description) => {
    try {
        log(`Testing: ${description}`);
        const response = await api.get('/api/tenant/sales/dashboard');
        
        if (response.data.success) {
            logSuccess(`✓ ${description} - SUCCESS`);
            return true;
        } else {
            logError(`✗ ${description} - FAILED: ${response.data.message || 'Unknown error'}`);
            return false;
        }
    } catch (error) {
        if (error.response && error.response.status === 500) {
            const errorMessage = error.response.data?.message || error.response.data?.error || 'Unknown error';
            if (errorMessage.includes('Op.col is not a function')) {
                logError(`✗ ${description} - Op.col ERROR STILL EXISTS!`);
                logError(`   Error: ${errorMessage}`);
                return false;
            } else {
                logError(`✗ ${description} - Server Error: ${errorMessage}`);
                return false;
            }
        } else {
            logError(`✗ ${description} - Network Error: ${error.message}`);
            return false;
        }
    }
};

const testSalesPayments = async (api, description) => {
    try {
        log(`Testing: ${description}`);
        const response = await api.get('/api/tenant/sales/payments');
        
        if (response.data.success) {
            logSuccess(`✓ ${description} - SUCCESS`);
            return true;
        } else {
            logError(`✗ ${description} - FAILED: ${response.data.message || 'Unknown error'}`);
            return false;
        }
    } catch (error) {
        if (error.response && error.response.status === 500) {
            const errorMessage = error.response.data?.message || error.response.data?.error || 'Unknown error';
            if (errorMessage.includes('Op.col is not a function')) {
                logError(`✗ ${description} - Op.col ERROR STILL EXISTS!`);
                return false;
            } else {
                logError(`✗ ${description} - Server Error: ${errorMessage}`);
                return false;
            }
        } else {
            logError(`✗ ${description} - Network Error: ${error.message}`);
            return false;
        }
    }
};

const testDailySales = async (api, description) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        log(`Testing: ${description}`);
        const response = await api.get(`/api/tenant/sales/daily?date=${today}`);
        
        if (response.data.success) {
            logSuccess(`✓ ${description} - SUCCESS`);
            return true;
        } else {
            logError(`✗ ${description} - FAILED: ${response.data.message || 'Unknown error'}`);
            return false;
        }
    } catch (error) {
        if (error.response && error.response.status === 500) {
            const errorMessage = error.response.data?.message || error.response.data?.error || 'Unknown error';
            if (errorMessage.includes('Op.col is not a function')) {
                logError(`✗ ${description} - Op.col ERROR STILL EXISTS!`);
                return false;
            } else {
                logError(`✗ ${description} - Server Error: ${errorMessage}`);
                return false;
            }
        } else {
            logError(`✗ ${description} - Network Error: ${error.message}`);
            return false;
        }
    }
};

// Main test function
const runDashboardVerification = async () => {
    log('\n' + '='.repeat(60));
    log('🔍 DASHBOARD API VERIFICATION - Op.col FIX', colors.bold);
    log('='.repeat(60));
    log(`🔗 Base URL: ${BASE_URL}`);
    
    let allTestsPassed = true;
    
    // Step 1: Admin Login
    const adminToken = await testAdminLogin();
    if (!adminToken) {
        logError('Cannot proceed without admin token');
        process.exit(1);
    }
    
    const adminApi = createApi(adminToken);
    
    // Step 2: Test Admin Dashboard (should work)
    logStep(2, 'Testing Admin Dashboard APIs');
    const adminDashboardTests = [
        { test: () => testSalesDashboard(adminApi, 'Admin Sales Dashboard'), desc: 'Admin Sales Dashboard' },
        { test: () => testSalesPayments(adminApi, 'Admin Sales Payments'), desc: 'Admin Sales Payments' },
        { test: () => testDailySales(adminApi, 'Admin Daily Sales'), desc: 'Admin Daily Sales' }
    ];
    
    for (const { test, desc } of adminDashboardTests) {
        const result = await test();
        if (!result) allTestsPassed = false;
    }
    
    // Step 3: Test with existing user token (if provided)
    const existingUserToken = process.env.USER_TOKEN;
    if (existingUserToken) {
        logStep(3, 'Testing with Existing User Token');
        const userApi = createApi(existingUserToken);
        
        const userDashboardTests = [
            { test: () => testSalesDashboard(userApi, 'User Sales Dashboard'), desc: 'User Sales Dashboard' },
            { test: () => testSalesPayments(userApi, 'User Sales Payments'), desc: 'User Sales Payments' },
            { test: () => testDailySales(userApi, 'User Daily Sales'), desc: 'User Daily Sales' }
        ];
        
        for (const { test, desc } of userDashboardTests) {
            const result = await test();
            if (!result) allTestsPassed = false;
        }
    } else {
        logWarning('No USER_TOKEN provided - skipping existing user tests');
        log('   Set USER_TOKEN environment variable to test with existing user');
    }
    
    // Results
    log('\n' + '='.repeat(60));
    if (allTestsPassed) {
        log('🎉 ALL TESTS PASSED!', colors.bold + colors.green);
        log('✅ Op.col issue has been FIXED');
        log('✅ Dashboard APIs are working correctly');
        log('✅ Ready for new user onboarding');
        log('\n📋 Next Steps:');
        log('1. Test with actual new user onboarding');
        log('2. Verify frontend integration');
        log('3. Monitor production for any remaining issues');
    } else {
        log('🚨 SOME TESTS FAILED!', colors.bold + colors.red);
        log('❌ Op.col issue may still exist');
        log('❌ Check error messages above');
        log('❌ Review the failing controllers');
        log('\n🔧 Troubleshooting:');
        log('1. Check if server needs restart');
        log('2. Verify all Sequelize imports');
        log('3. Ensure proper model injection');
    }
    log('='.repeat(60));
    
    process.exit(allTestsPassed ? 0 : 1);
};

// Check if BASE_URL is set
if (!BASE_URL) {
    logError('Please set BASE_URL environment variable');
    log('Example: export BASE_URL=http://localhost:3000');
    process.exit(1);
}

// Run verification
runDashboardVerification().catch(error => {
    logError(`Verification script failed: ${error.message}`);
    process.exit(1);
});
