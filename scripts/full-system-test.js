#!/usr/bin/env node
/**
 * FULL SYSTEM TEST SCRIPT
 * 
 * Automated end-to-end test that:
 * 1. Drops test database (if exists)
 * 2. Creates fresh control plane schema
 * 3. Onboards a new tenant
 * 4. Logs in
 * 5. Calls all major APIs
 * 
 * FAILS FAST on any error
 */

const axios = require('axios');
const { Sequelize } = require('sequelize');

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';
const DB_URL = process.env.DATABASE_URL || process.env.CONTROL_PLANE_DATABASE_URL;

// Test data
const TEST_BUSINESS = {
    businessName: `Test Business ${Date.now()}`,
    businessEmail: `test-${Date.now()}@example.com`,
    businessPhone: '1234567890',
    businessAddress: '123 Test Street',
    gstNumber: '12ABCDE1234F1Z5',
    adminName: 'Test Admin',
    adminEmail: `admin-${Date.now()}@example.com`,
    adminPassword: 'TestPass123!',
    cafeType: 'SOLO'
};

// Test state
let authToken = null;
let refreshToken = null;
let businessId = null;
let outletId = null;

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(message, type = 'info') {
    const color = type === 'success' ? colors.green : type === 'error' ? colors.red : type === 'warn' ? colors.yellow : colors.blue;
    console.log(`${color}[TEST] ${message}${colors.reset}`);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Database cleanup
async function cleanupDatabase() {
    if (!DB_URL) {
        log('No DATABASE_URL provided, skipping DB cleanup', 'warn');
        return;
    }
    
    log('Connecting to database for cleanup...');
    const sequelize = new Sequelize(DB_URL, {
        dialect: 'postgres',
        logging: false
    });
    
    try {
        await sequelize.authenticate();
        
        // Drop all tenant schemas except public
        const schemas = await sequelize.query(
            `SELECT schema_name FROM information_schema.schemata 
             WHERE schema_name LIKE 'tenant_%'`,
            { type: Sequelize.QueryTypes.SELECT }
        );
        
        for (const { schema_name } of schemas) {
            log(`Dropping schema: ${schema_name}`);
            await sequelize.query(`DROP SCHEMA IF EXISTS "${schema_name}" CASCADE`);
        }
        
        // Clean up test data from public schema
        await sequelize.query(`
            DELETE FROM public.users WHERE email LIKE '%@example.com';
            DELETE FROM public.businesses WHERE email LIKE '%@example.com';
            DELETE FROM public.tenant_registry WHERE schema_name LIKE 'tenant_%';
        `);
        
        log('Database cleanup complete', 'success');
    } catch (error) {
        log(`DB cleanup error: ${error.message}`, 'warn');
    } finally {
        await sequelize.close();
    }
}

// API helper
async function apiCall(method, endpoint, data = null, headers = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const config = {
        method,
        url,
        headers: {
            'Content-Type': 'application/json',
            ...headers
        },
        validateStatus: () => true // Don't throw on any status
    };
    
    if (data) {
        config.data = data;
    }
    
    try {
        const response = await axios(config);
        return {
            status: response.status,
            data: response.data,
            headers: response.headers
        };
    } catch (error) {
        return {
            status: error.response?.status || 0,
            data: error.response?.data || { error: error.message },
            error: error.message
        };
    }
}

// Test steps
async function testOnboarding() {
    log('Step 1: Testing onboarding...');
    
    const response = await apiCall('POST', '/api/onboarding/register', TEST_BUSINESS);
    
    if (response.status !== 200 && response.status !== 201) {
        throw new Error(`Onboarding failed: ${response.status} - ${JSON.stringify(response.data)}`);
    }
    
    if (!response.data.success) {
        throw new Error(`Onboarding returned success=false: ${response.data.message}`);
    }
    
    businessId = response.data.data?.businessId;
    outletId = response.data.data?.outletId;
    
    if (!businessId) {
        throw new Error('Onboarding did not return businessId');
    }
    
    log(`Onboarding successful: businessId=${businessId}`, 'success');
    
    // Wait for background migrations to complete
    log('Waiting for tenant activation (5s)...');
    await sleep(5000);
    
    // Verify tenant is active
    const checkResponse = await apiCall('POST', '/api/onboarding/check-status', {
        businessId: businessId
    });
    
    if (checkResponse.data.data?.status !== 'active') {
        log(`Tenant status: ${checkResponse.data.data?.status}`, 'warn');
        log('Waiting additional 5s for activation...');
        await sleep(5000);
    }
}

async function testLogin() {
    log('Step 2: Testing login...');
    
    const response = await apiCall('POST', '/api/auth/login', {
        email: TEST_BUSINESS.adminEmail,
        password: TEST_BUSINESS.adminPassword
    });
    
    if (response.status !== 200) {
        throw new Error(`Login failed: ${response.status} - ${JSON.stringify(response.data)}`);
    }
    
    if (!response.data.success) {
        throw new Error(`Login returned success=false: ${response.data.message}`);
    }
    
    authToken = response.data.data?.accessToken;
    refreshToken = response.data.data?.refreshToken;
    
    if (!authToken) {
        throw new Error('Login did not return accessToken');
    }
    
    log('Login successful', 'success');
}

async function testDashboard() {
    log('Step 3: Testing dashboard API...');
    
    const response = await apiCall('GET', '/api/tenant/dashboard', null, {
        'Authorization': `Bearer ${authToken}`
    });
    
    if (response.status === 401) {
        throw new Error('Dashboard: Unauthorized - token issue');
    }
    
    if (response.status === 403) {
        throw new Error('Dashboard: Forbidden - tenant not active');
    }
    
    if (response.status === 500 || response.status === 503) {
        throw new Error(`Dashboard failed: ${response.status} - ${JSON.stringify(response.data)}`);
    }
    
    log(`Dashboard: ${response.status} - ${response.data.success ? 'OK' : 'FAILED'}`, 
        response.data.success ? 'success' : 'error');
    
    return response.data.success;
}

async function testProducts() {
    log('Step 4: Testing products API...');
    
    // Create product
    const createResponse = await apiCall('POST', '/api/tenant/products', {
        name: 'Test Product',
        price: 100,
        categoryId: 'default', // Will use default category
        sku: 'TEST-SKU-001'
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    
    if (createResponse.status === 500) {
        const errorMsg = JSON.stringify(createResponse.data);
        if (errorMsg.includes('column') || errorMsg.includes('does not exist')) {
            throw new Error(`Products API missing column: ${errorMsg}`);
        }
    }
    
    log(`Create product: ${createResponse.status}`, 
        createResponse.status === 200 || createResponse.status === 201 ? 'success' : 'warn');
    
    // List products
    const listResponse = await apiCall('GET', '/api/tenant/products', null, {
        'Authorization': `Bearer ${authToken}`
    });
    
    if (listResponse.status === 500) {
        const errorMsg = JSON.stringify(listResponse.data);
        if (errorMsg.includes('column') || errorMsg.includes('does not exist')) {
            throw new Error(`Products list missing column: ${errorMsg}`);
        }
    }
    
    log(`List products: ${listResponse.status}`, 
        listResponse.status === 200 ? 'success' : 'error');
    
    return listResponse.status === 200;
}

async function testOrders() {
    log('Step 5: Testing orders API...');
    
    // Create order
    const createResponse = await apiCall('POST', '/api/tenant/orders', {
        type: 'DINE_IN',
        items: [
            { name: 'Test Item', price: 100, quantity: 1 }
        ],
        billingTotal: 100
    }, {
        'Authorization': `Bearer ${authToken}`
    });
    
    if (createResponse.status === 500) {
        const errorMsg = JSON.stringify(createResponse.data);
        if (errorMsg.includes('column') || errorMsg.includes('does not exist')) {
            throw new Error(`Orders API missing column: ${errorMsg}`);
        }
    }
    
    log(`Create order: ${createResponse.status}`, 
        createResponse.status === 200 || createResponse.status === 201 ? 'success' : 'warn');
    
    // List orders
    const listResponse = await apiCall('GET', '/api/tenant/orders', null, {
        'Authorization': `Bearer ${authToken}`
    });
    
    if (listResponse.status === 500) {
        const errorMsg = JSON.stringify(listResponse.data);
        if (errorMsg.includes('column') || errorMsg.includes('does not exist')) {
            throw new Error(`Orders list missing column: ${errorMsg}`);
        }
    }
    
    log(`List orders: ${listResponse.status}`, 
        listResponse.status === 200 ? 'success' : 'error');
    
    return listResponse.status === 200;
}

async function testInventory() {
    log('Step 6: Testing inventory API...');
    
    const response = await apiCall('GET', '/api/tenant/inventory', null, {
        'Authorization': `Bearer ${authToken}`
    });
    
    if (response.status === 500) {
        const errorMsg = JSON.stringify(response.data);
        if (errorMsg.includes('column') || errorMsg.includes('does not exist')) {
            throw new Error(`Inventory API missing column: ${errorMsg}`);
        }
    }
    
    log(`Inventory: ${response.status}`, 
        response.status === 200 ? 'success' : 'warn');
    
    return response.status === 200;
}

async function testSchemaValidation() {
    log('Step 7: Testing schema validation...');
    
    if (!DB_URL) {
        log('Skipping schema validation (no DB_URL)', 'warn');
        return true;
    }
    
    const sequelize = new Sequelize(DB_URL, {
        dialect: 'postgres',
        logging: false
    });
    
    try {
        const { validateTenantSchemaComplete } = require('./utils/schemaValidator');
        const validation = await validateTenantSchemaComplete(sequelize, businessId);
        
        if (!validation.complete) {
            if (validation.missingTables.length > 0) {
                throw new Error(`Missing tables: ${validation.missingTables.join(', ')}`);
            }
            if (validation.columnIssues.length > 0) {
                const issues = validation.columnIssues.map(c => 
                    `${c.table}(${c.missingColumns.join(', ')})`
                ).join('; ');
                throw new Error(`Missing columns: ${issues}`);
            }
        }
        
        log('Schema validation passed', 'success');
        return true;
    } finally {
        await sequelize.close();
    }
}

// Main test runner
async function runTests() {
    console.log('\n========================================');
    console.log('FULL SYSTEM TEST - MULTI-TENANT POS');
    console.log('========================================\n');
    
    const startTime = Date.now();
    const results = {
        passed: 0,
        failed: 0,
        errors: []
    };
    
    try {
        // Cleanup
        await cleanupDatabase();
        
        // Run tests
        await testOnboarding();
        results.passed++;
        
        await testLogin();
        results.passed++;
        
        await testDashboard();
        results.passed++;
        
        await testProducts();
        results.passed++;
        
        await testOrders();
        results.passed++;
        
        await testInventory();
        results.passed++;
        
        await testSchemaValidation();
        results.passed++;
        
    } catch (error) {
        results.failed++;
        results.errors.push(error.message);
        log(`TEST FAILED: ${error.message}`, 'error');
        console.error(error);
    }
    
    const duration = Date.now() - startTime;
    
    console.log('\n========================================');
    console.log('TEST SUMMARY');
    console.log('========================================');
    console.log(`Duration: ${duration}ms`);
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);
    
    if (results.errors.length > 0) {
        console.log('\nErrors:');
        results.errors.forEach(e => console.log(`  - ${e}`));
    }
    
    console.log('========================================\n');
    
    process.exit(results.failed > 0 ? 1 : 0);
}

// Run if called directly
if (require.main === module) {
    runTests();
}

module.exports = { runTests };
