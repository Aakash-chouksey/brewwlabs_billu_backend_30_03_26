#!/usr/bin/env node

/**
 * COMPREHENSIVE API TESTING SUITE
 * 
 * Tests all APIs after tenant connection infrastructure changes
 * Identifies issues caused by model injection changes
 */

require('dotenv').config();
const axios = require('axios');

// Configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8000';
const TEST_TENANT_ID = process.env.TEST_TENANT_ID || 'test-brand-id';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'test123';

console.log('🧪 COMPREHENSIVE API TESTING SUITE');
console.log('====================================');
console.log(`Base URL: ${BASE_URL}`);
console.log(`Test Tenant: ${TEST_TENANT_ID}`);
console.log('');

// Test results tracking
const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
};

// Test utilities
const testRequest = async (method, url, data = null, headers = {}) => {
    try {
        const config = {
            method,
            url: `${BASE_URL}${url}`,
            headers: {
                'Content-Type': 'application/json',
                'x-tenant-id': TEST_TENANT_ID,
                'x-panel-type': 'TENANT',
                ...headers
            }
        };
        
        if (data) {
            config.data = data;
        }
        
        const response = await axios(config);
        return { success: true, status: response.status, data: response.data };
    } catch (error) {
        return { 
            success: false, 
            status: error.response?.status || 500, 
            error: error.response?.data || error.message 
        };
    }
};

const runTest = async (name, method, url, data = null, expectedStatus = 200) => {
    testResults.total++;
    console.log(`🧪 Testing: ${name} (${method} ${url})`);
    
    const result = await testRequest(method, url, data);
    
    if (result.success && result.status === expectedStatus) {
        testResults.passed++;
        console.log(`✅ PASS: ${name}`);
        return true;
    } else {
        testResults.failed++;
        const error = `❌ FAIL: ${name} - Status: ${result.status}, Error: ${result.error}`;
        console.log(error);
        testResults.errors.push({
            test: name,
            method,
            url,
            expectedStatus,
            actualStatus: result.status,
            error: result.error
        });
        return false;
    }
};

// API Test Categories
const apiTests = {
    // Authentication APIs
    auth: [
        { name: 'Send OTP', method: 'POST', url: '/api/auth/send-otp', data: { email: TEST_USER_EMAIL }, expectedStatus: 200 },
        { name: 'Login', method: 'POST', url: '/api/auth/login', data: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD }, expectedStatus: 200 },
        { name: 'Refresh Token', method: 'POST', url: '/api/auth/refresh', data: { refreshToken: 'test' }, expectedStatus: 401 },
        { name: 'Get Profile', method: 'GET', url: '/api/auth/me', expectedStatus: 401 }
    ],

    // Tenant APIs - Users
    users: [
        { name: 'Get Users', method: 'GET', url: '/api/tenant/users', expectedStatus: 401 }, // Should fail without auth
        { name: 'Get Profile', method: 'GET', url: '/api/tenant/profile', expectedStatus: 401 },
        { name: 'Create User', method: 'POST', url: '/api/tenant/users', data: { name: 'Test User', email: 'test@user.com', password: 'test123' }, expectedStatus: 401 }
    ],

    // Tenant APIs - Categories
    categories: [
        { name: 'Get Categories', method: 'GET', url: '/api/tenant/categories', expectedStatus: 401 },
        { name: 'Create Category', method: 'POST', url: '/api/tenant/categories', data: { name: 'Test Category' }, expectedStatus: 401 },
        { name: 'Update Category', method: 'PUT', url: '/api/tenant/categories/1', data: { name: 'Updated Category' }, expectedStatus: 401 },
        { name: 'Delete Category', method: 'DELETE', url: '/api/tenant/categories/1', expectedStatus: 401 }
    ],

    // Tenant APIs - Products
    products: [
        { name: 'Get Products', method: 'GET', url: '/api/tenant/products', expectedStatus: 401 },
        { name: 'Create Product', method: 'POST', url: '/api/tenant/products', data: { name: 'Test Product', price: 100 }, expectedStatus: 401 },
        { name: 'Update Product', method: 'PUT', url: '/api/tenant/products/1', data: { name: 'Updated Product' }, expectedStatus: 401 },
        { name: 'Delete Product', method: 'DELETE', url: '/api/tenant/products/1', expectedStatus: 401 }
    ],

    // Tenant APIs - Orders
    orders: [
        { name: 'Get Orders', method: 'GET', url: '/api/tenant/orders', expectedStatus: 401 },
        { name: 'Create Order', method: 'POST', url: '/api/tenant/orders', data: { items: [], total: 0 }, expectedStatus: 401 },
        { name: 'Get Order by ID', method: 'GET', url: '/api/tenant/orders/1', expectedStatus: 401 },
        { name: 'Update Order', method: 'PUT', url: '/api/tenant/orders/1', data: { status: 'completed' }, expectedStatus: 401 }
    ],

    // Tenant APIs - Tables
    tables: [
        { name: 'Get Tables', method: 'GET', url: '/api/tenant/tables', expectedStatus: 401 },
        { name: 'Create Table', method: 'POST', url: '/api/tenant/tables', data: { number: 1, capacity: 4 }, expectedStatus: 401 },
        { name: 'Update Table', method: 'PUT', url: '/api/tenant/tables/1', data: { number: 2 }, expectedStatus: 401 },
        { name: 'Delete Table', method: 'DELETE', url: '/api/tenant/tables/1', expectedStatus: 401 }
    ],

    // Tenant APIs - Dashboard
    dashboard: [
        { name: 'Get Dashboard Stats', method: 'GET', url: '/api/tenant/dashboard', expectedStatus: 401 }
    ],

    // Tenant APIs - Payments
    payments: [
        { name: 'Create Payment Order', method: 'POST', url: '/api/tenant/payments/create-order', data: { amount: 100 }, expectedStatus: 401 },
        { name: 'Verify Payment', method: 'POST', url: '/api/tenant/payments/verify', data: { payment_id: 'test' }, expectedStatus: 401 }
    ],

    // Tenant APIs - Reports
    reports: [
        { name: 'Get Sales Report', method: 'GET', url: '/api/tenant/reports/sales', expectedStatus: 401 },
        { name: 'Get Inventory Report', method: 'GET', url: '/api/tenant/reports/inventory', expectedStatus: 401 },
        { name: 'Get Daily Sales', method: 'GET', url: '/api/tenant/sales/daily', expectedStatus: 401 }
    ],

    // Tenant APIs - Inventory
    inventory: [
        { name: 'Get Inventory Items', method: 'GET', url: '/api/tenant/inventory/items', expectedStatus: 401 },
        { name: 'Add Inventory Item', method: 'POST', url: '/api/tenant/inventory/items', data: { name: 'Test Item', quantity: 10 }, expectedStatus: 401 },
        { name: 'Get Low Stock', method: 'GET', url: '/api/tenant/inventory/low-stock', expectedStatus: 401 }
    ],

    // Tenant APIs - Accounting
    accounting: [
        { name: 'Get Accounts', method: 'GET', url: '/api/tenant/accounting/accounts', expectedStatus: 401 },
        { name: 'Create Account', method: 'POST', url: '/api/tenant/accounting/accounts', data: { name: 'Test Account' }, expectedStatus: 401 },
        { name: 'Get Transactions', method: 'GET', url: '/api/tenant/accounting/transactions', expectedStatus: 401 }
    ],

    // Tenant APIs - Areas
    areas: [
        { name: 'Get Areas', method: 'GET', url: '/api/tenant/areas', expectedStatus: 401 },
        { name: 'Create Area', method: 'POST', url: '/api/tenant/areas', data: { name: 'Test Area' }, expectedStatus: 401 }
    ],

    // Admin APIs (should require admin panel type)
    admin: [
        { name: 'Get Admin Dashboard', method: 'GET', url: '/api/admin/dashboard', expectedStatus: 403 }, // Should fail without admin panel type
        { name: 'Get Businesses', method: 'GET', url: '/api/admin/businesses', expectedStatus: 403 },
        { name: 'Get All Users', method: 'GET', url: '/api/admin/users/all', expectedStatus: 403 }
    ]
};

async function runTestSuite() {
    console.log('🚀 Starting comprehensive API testing...\n');
    
    // Test each category
    for (const [category, tests] of Object.entries(apiTests)) {
        console.log(`\n📂 Testing ${category.toUpperCase()} APIs:`);
        console.log('-------------------------------');
        
        for (const test of tests) {
            await runTest(test.name, test.method, test.url, test.data, test.expectedStatus);
        }
    }
    
    // Print results
    console.log('\n🎯 TEST RESULTS');
    console.log('===============');
    console.log(`Total Tests: ${testResults.total}`);
    console.log(`Passed: ${testResults.passed} ✅`);
    console.log(`Failed: ${testResults.failed} ❌`);
    console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
    
    if (testResults.errors.length > 0) {
        console.log('\n❌ FAILED TESTS:');
        console.log('================');
        testResults.errors.forEach(error => {
            console.log(`${error.test}: ${error.method} ${error.url}`);
            console.log(`  Expected: ${error.expectedStatus}, Got: ${error.actualStatus}`);
            console.log(`  Error: ${error.error}`);
            console.log('');
        });
    }
    
    // Analysis
    console.log('\n🔍 ERROR ANALYSIS');
    console.log('=================');
    
    const authErrors = testResults.errors.filter(e => e.actualStatus === 401);
    const serverErrors = testResults.errors.filter(e => e.actualStatus >= 500);
    const clientErrors = testResults.errors.filter(e => e.actualStatus >= 400 && e.actualStatus < 500);
    
    console.log(`Authentication Errors (401): ${authErrors.length}`);
    console.log(`Server Errors (5xx): ${serverErrors.length}`);
    console.log(`Client Errors (4xx): ${clientErrors.length}`);
    
    if (serverErrors.length > 0) {
        console.log('\n🚨 CRITICAL: Server errors detected!');
        console.log('These are likely caused by tenant connection issues.');
        serverErrors.forEach(error => {
            console.log(`  ${error.test}: ${error.error}`);
        });
    }
    
    return {
        total: testResults.total,
        passed: testResults.passed,
        failed: testResults.failed,
        successRate: (testResults.passed / testResults.total) * 100,
        serverErrors: serverErrors.length,
        authErrors: authErrors.length,
        criticalIssues: serverErrors.length
    };
}

// Run tests if called directly
if (require.main === module) {
    runTestSuite()
        .then(results => {
            console.log('\n🏁 TESTING COMPLETE');
            console.log('===================');
            
            if (results.criticalIssues > 0) {
                console.log('🔴 CRITICAL ISSUES FOUND - Tenant connection system needs fixes');
                process.exit(1);
            } else if (results.failed > 0) {
                console.log('🟡 MINOR ISSUES FOUND - Some APIs need attention');
                process.exit(0);
            } else {
                console.log('🟢 ALL TESTS PASSED - System is stable');
                process.exit(0);
            }
        })
        .catch(error => {
            console.error('❌ Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = { runTestSuite, testRequest, runTest };
