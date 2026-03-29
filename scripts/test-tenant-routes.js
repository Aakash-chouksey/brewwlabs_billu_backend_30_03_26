#!/usr/bin/env node
/**
 * COMPREHENSIVE TENANT ROUTE TESTER
 * Tests all tenant routes and reports issues
 */

const http = require('http');
const path = require('path');

// Configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8000';
const TEST_TIMEOUT = 30000;

// Test results storage
const results = {
    passed: [],
    failed: [],
    warnings: [],
    skipped: []
};

// Color codes for terminal output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(type, message) {
    const timestamp = new Date().toISOString();
    const color = type === 'PASS' ? colors.green : 
                  type === 'FAIL' ? colors.red : 
                  type === 'WARN' ? colors.yellow : colors.blue;
    console.log(`${color}[${type}]${colors.reset} ${message}`);
}

/**
 * Make HTTP request
 */
function makeRequest(path, method = 'GET', headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            timeout: TEST_TIMEOUT
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ status: res.statusCode, headers: res.headers, body: json });
                } catch (e) {
                    resolve({ status: res.statusCode, headers: res.headers, body: data, parseError: true });
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => reject(new Error('Request timeout')));

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

/**
 * Test authentication endpoints first
 */
async function testAuth() {
    log('INFO', '=== Testing Authentication ===');
    
    // Test login (this is a control plane route)
    try {
        const response = await makeRequest('/api/auth/login', 'POST', {}, {
            email: 'test@example.com',
            password: 'test123'
        });
        
        if (response.status === 200 && response.body?.token) {
            log('PASS', 'Login endpoint accessible');
            return response.body.token;
        } else if (response.status === 401 || response.status === 404) {
            log('WARN', 'Login requires valid credentials - skipping authenticated tests');
            return null;
        } else {
            log('FAIL', `Login returned status ${response.status}: ${JSON.stringify(response.body)}`);
            return null;
        }
    } catch (error) {
        log('FAIL', `Login request failed: ${error.message}`);
        return null;
    }
}

/**
 * Test tenant routes with token
 */
async function testTenantRoutes(token) {
    log('INFO', '=== Testing Tenant Routes ===');
    
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    
    // Define all tenant routes to test
    const routes = [
        // Dashboard
        { path: '/api/tenant/dashboard', method: 'GET', name: 'Dashboard Stats' },
        
        // Categories
        { path: '/api/tenant/categories', method: 'GET', name: 'Get Categories' },
        { path: '/api/tenant/categories', method: 'POST', name: 'Create Category', body: { name: 'Test Category', color: '#3B82F6' } },
        
        // Products
        { path: '/api/tenant/products', method: 'GET', name: 'Get Products' },
        
        // Orders
        { path: '/api/tenant/orders', method: 'GET', name: 'Get Orders' },
        { path: '/api/tenant/orders/archived', method: 'GET', name: 'Get Archived Orders' },
        
        // Tables
        { path: '/api/tenant/tables', method: 'GET', name: 'Get Tables' },
        
        // Areas
        { path: '/api/tenant/areas', method: 'GET', name: 'Get Areas' },
        
        // Outlets
        { path: '/api/tenant/outlets', method: 'GET', name: 'Get Outlets' },
        
        // Profile
        { path: '/api/tenant/profile', method: 'GET', name: 'Get Profile' },
        
        // Business
        { path: '/api/tenant/business', method: 'GET', name: 'Get Business Info' },
        
        // Sales
        { path: '/api/tenant/sales/daily', method: 'GET', name: 'Daily Sales' },
        { path: '/api/tenant/sales/dashboard', method: 'GET', name: 'Sales Dashboard' },
        
        // Reports
        { path: '/api/tenant/reports/daily-sales', method: 'GET', name: 'Daily Sales Report' },
        
        // Analytics
        { path: '/api/tenant/analytics/summary', method: 'GET', name: 'Analytics Summary' },
        { path: '/api/tenant/analytics/trends', method: 'GET', name: 'Sales Trends' },
        
        // Inventory
        { path: '/api/tenant/inventory/items', method: 'GET', name: 'Get Inventory Items' },
        { path: '/api/tenant/inventory/dashboard', method: 'GET', name: 'Inventory Dashboard' },
        { path: '/api/tenant/inventory/low-stock', method: 'GET', name: 'Low Stock Items' },
        
        // Staff
        { path: '/api/tenant/users', method: 'GET', name: 'Get Users' },
        
        // Live
        { path: '/api/tenant/live-orders', method: 'GET', name: 'Live Orders' },
        { path: '/api/tenant/live-stats', method: 'GET', name: 'Live Stats' },
        
        // Control Center
        { path: '/api/tenant/control-center', method: 'GET', name: 'Control Center Stats' },
        { path: '/api/tenant/system-health', method: 'GET', name: 'System Health' },
        
        // Billing Config
        { path: '/api/tenant/billing/config', method: 'GET', name: 'Billing Config' },
        
        // Product Types
        { path: '/api/tenant/product-types', method: 'GET', name: 'Product Types' },
        
        // Expense Types
        { path: '/api/tenant/expense-types', method: 'GET', name: 'Expense Types' },
        
        // Purchases
        { path: '/api/tenant/purchases', method: 'GET', name: 'Get Purchases' },
        
        // Inventory Categories
        { path: '/api/tenant/inventory-categories', method: 'GET', name: 'Inventory Categories' },
        
        // Suppliers
        { path: '/api/tenant/inventory/suppliers', method: 'GET', name: 'Get Suppliers' },
        
        // Recipes
        { path: '/api/tenant/recipes', method: 'GET', name: 'Get Recipes' },
        
        // Operation Timings
        { path: '/api/tenant/operation-timings', method: 'GET', name: 'Operation Timings' },
        
        // Inventory Sales
        { path: '/api/tenant/inventory-sales', method: 'GET', name: 'Inventory Sales' },
        
        // Wastage
        { path: '/api/tenant/inventory/wastage', method: 'GET', name: 'Wastage Records' },
        
        // Table Management
        { path: '/api/tenant/tables-management', method: 'GET', name: 'Table Management' },
    ];
    
    for (const route of routes) {
        try {
            const response = await makeRequest(route.path, route.method, headers, route.body);
            
            // Check for expected responses
            if (response.status === 200 || response.status === 201) {
                if (response.body && typeof response.body === 'object') {
                    if (response.body.success === true) {
                        log('PASS', `${route.name} - Status ${response.status}, success: true`);
                        results.passed.push({ route: route.name, status: response.status });
                    } else if (response.body.success === false) {
                        log('FAIL', `${route.name} - success: false, message: ${response.body.message || 'No message'}`);
                        results.failed.push({ route: route.name, status: response.status, error: response.body.message });
                    } else {
                        log('WARN', `${route.name} - Missing success field in response`);
                        results.warnings.push({ route: route.name, status: response.status, issue: 'Missing success field' });
                    }
                } else {
                    log('WARN', `${route.name} - Response is not an object`);
                    results.warnings.push({ route: route.name, issue: 'Invalid response format' });
                }
            } else if (response.status === 401) {
                log('WARN', `${route.name} - Authentication required (401)`);
                results.warnings.push({ route: route.name, status: response.status, issue: 'Auth required' });
            } else if (response.status === 403) {
                log('WARN', `${route.name} - Forbidden (403) - Check role permissions`);
                results.warnings.push({ route: route.name, status: response.status, issue: 'Forbidden' });
            } else if (response.status === 404) {
                log('FAIL', `${route.name} - Not found (404) - Route may not exist`);
                results.failed.push({ route: route.name, status: response.status, error: 'Route not found' });
            } else if (response.status === 500) {
                log('FAIL', `${route.name} - Server error (500) - ${response.body?.message || 'Internal error'}`);
                results.failed.push({ route: route.name, status: response.status, error: response.body?.message || 'Server error' });
            } else if (response.status === 503) {
                log('FAIL', `${route.name} - Service unavailable (503) - Tenant may not be ready`);
                results.failed.push({ route: route.name, status: response.status, error: 'Service unavailable' });
            } else {
                log('WARN', `${route.name} - Unexpected status ${response.status}`);
                results.warnings.push({ route: route.name, status: response.status, issue: 'Unexpected status' });
            }
        } catch (error) {
            log('FAIL', `${route.name} - Request error: ${error.message}`);
            results.failed.push({ route: route.name, error: error.message });
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

/**
 * Print final report
 */
function printReport() {
    console.log('\n' + '='.repeat(80));
    console.log('TENANT ROUTE TEST REPORT');
    console.log('='.repeat(80));
    
    console.log(`\n${colors.green}PASSED: ${results.passed.length}${colors.reset}`);
    if (results.passed.length > 0) {
        results.passed.forEach(r => console.log(`  ✓ ${r.route}`));
    }
    
    console.log(`\n${colors.red}FAILED: ${results.failed.length}${colors.reset}`);
    if (results.failed.length > 0) {
        results.failed.forEach(r => console.log(`  ✗ ${r.route} - ${r.error || `Status ${r.status}`}`));
    }
    
    console.log(`\n${colors.yellow}WARNINGS: ${results.warnings.length}${colors.reset}`);
    if (results.warnings.length > 0) {
        results.warnings.forEach(r => console.log(`  ⚠ ${r.route} - ${r.issue || `Status ${r.status}`}`));
    }
    
    console.log('\n' + '='.repeat(80));
    const total = results.passed.length + results.failed.length + results.warnings.length;
    const passRate = total > 0 ? ((results.passed.length / total) * 100).toFixed(1) : 0;
    console.log(`TOTAL TESTED: ${total} | PASS RATE: ${passRate}%`);
    console.log('='.repeat(80) + '\n');
    
    // Return exit code
    return results.failed.length > 0 ? 1 : 0;
}

/**
 * Main test runner
 */
async function runTests() {
    console.log('\n🔍 TENANT ROUTE TEST SUITE\n');
    console.log(`Testing against: ${BASE_URL}\n`);
    
    try {
        // First test auth
        const token = await testAuth();
        
        // Test tenant routes
        await testTenantRoutes(token);
        
        // Print report
        const exitCode = printReport();
        
        process.exit(exitCode);
    } catch (error) {
        console.error('Test suite error:', error);
        process.exit(1);
    }
}

// Run tests
runTests();
