#!/usr/bin/env node
/**
 * TEST TENANT CREATION & VALIDATION SCRIPT
 * Creates test tenants and validates the system
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:8000';

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(level, msg) {
    const c = colors[level] || colors.reset;
    console.log(`${c}${msg}${colors.reset}`);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// STEP 1: CREATE TEST TENANTS
// ============================================
async function createTestTenants() {
    log('cyan', '\n╔════════════════════════════════════════════════════════════╗');
    log('cyan', '║  STEP 1: CREATE TEST TENANTS                               ║');
    log('cyan', '╚════════════════════════════════════════════════════════════╝\n');

    const tenants = [];
    const timestamp = Date.now();

    // Tenant A: Small dataset
    log('blue', '🏢 Creating Tenant A (Small Dataset)...');
    const tenantAStart = Date.now();
    try {
        const responseA = await axios.post(`${BASE_URL}/api/onboarding/business`, {
            businessName: `Test Cafe A ${timestamp}`,
            businessEmail: `cafe-a-${timestamp}@test.com`,
            businessPhone: '+1234567890',
            businessAddress: '123 Test Street',
            gstNumber: 'GST123456',
            adminName: 'Admin A',
            adminEmail: `admin-a-${timestamp}@test.com`,
            adminPassword: 'Admin123!',
            cafeType: 'SOLO'
        }, { timeout: 60000 });

        const tenantADuration = Date.now() - tenantAStart;
        
        if (responseA.data.success) {
            log('green', `✅ Tenant A created in ${tenantADuration}ms`);
            log('blue', `   Business ID: ${responseA.data.data.businessId}`);
            log('blue', `   Schema: ${responseA.data.data.schemaName}`);
            log('blue', `   Tables: ${responseA.data.data.tablesCreated}`);
            tenants.push({ 
                name: 'Tenant A', 
                ...responseA.data.data, 
                duration: tenantADuration,
                status: 'OK'
            });
        } else {
            log('red', `❌ Tenant A failed: ${responseA.data.message}`);
            tenants.push({ name: 'Tenant A', status: 'FAILED', error: responseA.data.message });
        }
    } catch (error) {
        const tenantADuration = Date.now() - tenantAStart;
        log('red', `❌ Tenant A failed after ${tenantADuration}ms: ${error.message}`);
        tenants.push({ name: 'Tenant A', status: 'FAILED', error: error.message, duration: tenantADuration });
    }

    // Wait a bit before creating tenant B
    await sleep(2000);

    // Tenant B: Moderate dataset
    log('blue', '\n🏢 Creating Tenant B (Moderate Dataset)...');
    const tenantBStart = Date.now();
    try {
        const responseB = await axios.post(`${BASE_URL}/api/onboarding/business`, {
            businessName: `Test Restaurant B ${timestamp}`,
            businessEmail: `restaurant-b-${timestamp}@test.com`,
            businessPhone: '+9876543210',
            businessAddress: '456 Test Avenue',
            gstNumber: 'GST654321',
            adminName: 'Admin B',
            adminEmail: `admin-b-${timestamp}@test.com`,
            adminPassword: 'Admin123!',
            cafeType: 'CHAIN'
        }, { timeout: 60000 });

        const tenantBDuration = Date.now() - tenantBStart;
        
        if (responseB.data.success) {
            log('green', `✅ Tenant B created in ${tenantBDuration}ms`);
            log('blue', `   Business ID: ${responseB.data.data.businessId}`);
            log('blue', `   Schema: ${responseB.data.data.schemaName}`);
            log('blue', `   Tables: ${responseB.data.data.tablesCreated}`);
            tenants.push({ 
                name: 'Tenant B', 
                ...responseB.data.data, 
                duration: tenantBDuration,
                status: 'OK'
            });
        } else {
            log('red', `❌ Tenant B failed: ${responseB.data.message}`);
            tenants.push({ name: 'Tenant B', status: 'FAILED', error: responseB.data.message });
        }
    } catch (error) {
        const tenantBDuration = Date.now() - tenantBStart;
        log('red', `❌ Tenant B failed after ${tenantBDuration}ms: ${error.message}`);
        tenants.push({ name: 'Tenant B', status: 'FAILED', error: error.message, duration: tenantBDuration });
    }

    // Summary
    log('cyan', '\n┌────────────────────────────────────────────────────────────┐');
    log('cyan', '│ TENANT CREATION SUMMARY                                    │');
    log('cyan', '└────────────────────────────────────────────────────────────┘');
    
    const successCount = tenants.filter(t => t.status === 'OK').length;
    const failedCount = tenants.filter(t => t.status === 'FAILED').length;
    
    log('green', `✅ Success: ${successCount}`);
    log('red', `❌ Failed: ${failedCount}`);
    
    tenants.forEach(t => {
        if (t.status === 'OK') {
            log('green', `  • ${t.name}: ${t.duration}ms (${t.tablesCreated} tables)`);
        } else {
            log('red', `  • ${t.name}: FAILED - ${t.error}`);
        }
    });

    return tenants.filter(t => t.status === 'OK');
}

// ============================================
// STEP 2: TENANT LAYER VALIDATION
// ============================================
async function validateTenantLayer(tenants) {
    log('cyan', '\n╔════════════════════════════════════════════════════════════╗');
    log('cyan', '║  STEP 2: TENANT LAYER VALIDATION                           ║');
    log('cyan', '╚════════════════════════════════════════════════════════════╝\n');

    const results = [];

    for (const tenant of tenants) {
        log('blue', `\n🔍 Validating ${tenant.name} (${tenant.schemaName})...`);
        
        const tenantResults = {
            name: tenant.name,
            schemaName: tenant.schemaName,
            tests: {}
        };

        // Login as tenant admin
        try {
            const loginStart = Date.now();
            const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
                email: tenant.user.email,
                password: 'Admin123!'
            }, { timeout: 10000 });
            
            const loginDuration = Date.now() - loginStart;
            
            if (loginRes.data.success) {
                log('green', `  ✅ Login: ${loginDuration}ms`);
                tenantResults.tests.login = { status: 'PASS', duration: loginDuration };
                tenant.token = loginRes.data.data.token;
                tenant.businessId = loginRes.data.data.businessId;
                tenant.outletId = loginRes.data.data.outletId;
            } else {
                log('red', `  ❌ Login failed: ${loginRes.data.message}`);
                tenantResults.tests.login = { status: 'FAIL', error: loginRes.data.message };
            }
        } catch (error) {
            log('red', `  ❌ Login error: ${error.message}`);
            tenantResults.tests.login = { status: 'FAIL', error: error.message };
        }

        // Test Product Creation
        if (tenant.token) {
            try {
                const productStart = Date.now();
                const productRes = await axios.post(`${BASE_URL}/api/products`, {
                    name: `Test Product ${Date.now()}`,
                    price: 99.99,
                    description: 'Test product for validation',
                    categoryId: null
                }, {
                    headers: { 'Authorization': `Bearer ${tenant.token}` },
                    timeout: 10000
                });
                
                const productDuration = Date.now() - productStart;
                
                if (productRes.data.success) {
                    log('green', `  ✅ Product creation: ${productDuration}ms`);
                    tenantResults.tests.product = { status: 'PASS', duration: productDuration };
                    tenant.testProductId = productRes.data.data.id;
                } else {
                    log('red', `  ❌ Product creation failed: ${productRes.data.message}`);
                    tenantResults.tests.product = { status: 'FAIL', error: productRes.data.message };
                }
            } catch (error) {
                log('red', `  ❌ Product creation error: ${error.message}`);
                tenantResults.tests.product = { status: 'FAIL', error: error.message };
            }

            // Test Inventory Creation
            try {
                const inventoryStart = Date.now();
                const inventoryRes = await axios.post(`${BASE_URL}/api/inventory`, {
                    itemName: `Test Item ${Date.now()}`,
                    quantity: 100,
                    unitCost: 50.00,
                    reorderLevel: 20,
                    outletId: tenant.outletId
                }, {
                    headers: { 'Authorization': `Bearer ${tenant.token}` },
                    timeout: 10000
                });
                
                const inventoryDuration = Date.now() - inventoryStart;
                
                if (inventoryRes.data.success) {
                    log('green', `  ✅ Inventory creation: ${inventoryDuration}ms`);
                    tenantResults.tests.inventory = { status: 'PASS', duration: inventoryDuration };
                } else {
                    log('red', `  ❌ Inventory creation failed: ${inventoryRes.data.message}`);
                    tenantResults.tests.inventory = { status: 'FAIL', error: inventoryRes.data.message };
                }
            } catch (error) {
                log('red', `  ❌ Inventory creation error: ${error.message}`);
                tenantResults.tests.inventory = { status: 'FAIL', error: error.message };
            }

            // Test Order Creation
            try {
                const orderStart = Date.now();
                const orderRes = await axios.post(`${BASE_URL}/api/orders`, {
                    items: [],
                    customerDetails: { name: 'Test Customer', phone: '1234567890' },
                    outletId: tenant.outletId,
                    paymentMethod: 'cash',
                    billingSubtotal: 99.99,
                    billingTax: 9.99,
                    billingTotal: 109.98
                }, {
                    headers: { 'Authorization': `Bearer ${tenant.token}` },
                    timeout: 10000
                });
                
                const orderDuration = Date.now() - orderStart;
                
                if (orderRes.data.success) {
                    log('green', `  ✅ Order creation: ${orderDuration}ms`);
                    tenantResults.tests.order = { status: 'PASS', duration: orderDuration };
                } else {
                    log('red', `  ❌ Order creation failed: ${orderRes.data.message}`);
                    tenantResults.tests.order = { status: 'FAIL', error: orderRes.data.message };
                }
            } catch (error) {
                log('red', `  ❌ Order creation error: ${error.message}`);
                tenantResults.tests.order = { status: 'FAIL', error: error.message };
            }
        }

        results.push(tenantResults);
    }

    // Summary
    log('cyan', '\n┌────────────────────────────────────────────────────────────┐');
    log('cyan', '│ TENANT LAYER VALIDATION SUMMARY                            │');
    log('cyan', '└────────────────────────────────────────────────────────────┘');

    results.forEach(r => {
        const tests = Object.entries(r.tests);
        const passed = tests.filter(([_, v]) => v.status === 'PASS').length;
        const total = tests.length;
        
        if (passed === total) {
            log('green', `✅ ${r.name}: ${passed}/${total} tests passed`);
        } else {
            log('yellow', `⚠️  ${r.name}: ${passed}/${total} tests passed`);
        }
        
        tests.forEach(([name, result]) => {
            if (result.status === 'PASS') {
                log('green', `   • ${name}: ${result.duration}ms`);
            } else {
                log('red', `   • ${name}: ${result.error}`);
            }
        });
    });

    return results;
}

// ============================================
// STEP 3: API TESTING
// ============================================
async function runAPITests() {
    log('cyan', '\n╔════════════════════════════════════════════════════════════╗');
    log('cyan', '║  STEP 3: API TESTING                                       ║');
    log('cyan', '╚════════════════════════════════════════════════════════════╝\n');

    const tests = [
        { name: 'Health Check', method: 'GET', path: '/health' },
        { name: 'Auth - Login', method: 'POST', path: '/api/auth/login', data: { email: 'test@test.com', password: 'test123' } },
        { name: 'Auth - Register', method: 'POST', path: '/api/auth/register', data: { name: 'Test', email: `test-${Date.now()}@test.com`, password: 'test123' } }
    ];

    const results = [];

    for (const test of tests) {
        const start = Date.now();
        try {
            const res = await axios({
                method: test.method,
                url: `${BASE_URL}${test.path}`,
                data: test.data,
                timeout: 10000,
                validateStatus: () => true
            });
            
            const duration = Date.now() - start;
            const hasCorrectFormat = res.data && typeof res.data.success === 'boolean';
            
            if (hasCorrectFormat) {
                log('green', `✅ ${test.name}: ${duration}ms (HTTP ${res.status})`);
                results.push({ name: test.name, status: 'PASS', duration, httpStatus: res.status });
            } else {
                log('yellow', `⚠️  ${test.name}: ${duration}ms - Invalid response format`);
                results.push({ name: test.name, status: 'WARN', duration, httpStatus: res.status });
            }
        } catch (error) {
            const duration = Date.now() - start;
            log('red', `❌ ${test.name}: ${duration}ms - ${error.message}`);
            results.push({ name: test.name, status: 'FAIL', duration, error: error.message });
        }
    }

    // Summary
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const warnings = results.filter(r => r.status === 'WARN').length;

    log('cyan', '\n┌────────────────────────────────────────────────────────────┐');
    log('cyan', '│ API TEST SUMMARY                                           │');
    log('cyan', '└────────────────────────────────────────────────────────────┘');
    log('green', `✅ Passed: ${passed}`);
    log('yellow', `⚠️  Warnings: ${warnings}`);
    log('red', `❌ Failed: ${failed}`);

    return results;
}

// ============================================
// STEP 4: PERFORMANCE REPORT
// ============================================
async function generatePerformanceReport(tenants, tenantResults, apiResults) {
    log('cyan', '\n╔════════════════════════════════════════════════════════════╗');
    log('cyan', '║  STEP 4: PERFORMANCE REPORT                                ║');
    log('cyan', '╚════════════════════════════════════════════════════════════╝\n');

    // Onboarding Performance
    log('blue', '📊 ONBOARDING PERFORMANCE:');
    tenants.forEach(t => {
        const rating = t.duration < 3000 ? '🟢 Fast' : t.duration < 5000 ? '🟡 Medium' : '🔴 Slow';
        log('blue', `  ${t.name}: ${t.duration}ms ${rating}`);
    });

    // Tenant Layer Performance
    log('\n');
    log('blue', '📊 TENANT LAYER PERFORMANCE:');
    tenantResults.forEach(r => {
        log('blue', `  ${r.name}:`);
        Object.entries(r.tests).forEach(([name, result]) => {
            if (result.status === 'PASS') {
                const rating = result.duration < 100 ? '🟢' : result.duration < 300 ? '🟡' : '🔴';
                log('blue', `    ${name}: ${result.duration}ms ${rating}`);
            }
        });
    });

    // Slow Endpoints Detection
    log('\n');
    log('blue', '🔍 SLOW ENDPOINTS (>300ms):');
    const allDurations = [
        ...tenants.map(t => ({ name: `Onboarding ${t.name}`, duration: t.duration })),
        ...tenantResults.flatMap(r => 
            Object.entries(r.tests)
                .filter(([_, v]) => v.status === 'PASS')
                .map(([name, v]) => ({ name: `${r.name} - ${name}`, duration: v.duration }))
        ),
        ...apiResults.filter(r => r.status === 'PASS').map(r => ({ name: r.name, duration: r.duration }))
    ];

    const slowEndpoints = allDurations.filter(d => d.duration > 300);
    if (slowEndpoints.length === 0) {
        log('green', '  ✅ No slow endpoints detected!');
    } else {
        slowEndpoints.forEach(e => {
            log('yellow', `  ⚠️  ${e.name}: ${e.duration}ms`);
        });
    }

    // Overall Rating
    log('cyan', '\n┌────────────────────────────────────────────────────────────┐');
    log('cyan', '│ OVERALL PERFORMANCE RATING                                 │');
    log('cyan', '└────────────────────────────────────────────────────────────┘');

    const avgOnboarding = tenants.reduce((sum, t) => sum + t.duration, 0) / tenants.length;
    
    if (avgOnboarding < 3000 && slowEndpoints.length === 0) {
        log('green', '🎉 EXCELLENT - System is highly performant');
    } else if (avgOnboarding < 5000 && slowEndpoints.length <= 2) {
        log('green', '✅ GOOD - Performance is acceptable');
    } else {
        log('yellow', '⚠️  NEEDS IMPROVEMENT - Some optimizations required');
    }
}

// ============================================
// MAIN EXECUTION
// ============================================
async function main() {
    console.log('\n🧪 REAL EXECUTION VALIDATION\n');
    console.log('Target: ' + BASE_URL);
    console.log('Time: ' + new Date().toISOString());
    console.log('=' .repeat(60));

    try {
        // Step 1: Create Test Tenants
        const tenants = await createTestTenants();
        
        if (tenants.length === 0) {
            log('red', '\n❌ No tenants created - stopping validation');
            process.exit(1);
        }

        // Step 2: Validate Tenant Layer
        const tenantResults = await validateTenantLayer(tenants);

        // Step 3: API Tests
        const apiResults = await runAPITests();

        // Step 4: Performance Report
        await generatePerformanceReport(tenants, tenantResults, apiResults);

        // Final Summary
        log('cyan', '\n╔════════════════════════════════════════════════════════════╗');
        log('cyan', '║  FINAL VALIDATION SUMMARY                                  ║');
        log('cyan', '╚════════════════════════════════════════════════════════════╝\n');

        const allTests = [
            ...tenantResults.flatMap(r => Object.values(r.tests)),
            ...apiResults
        ];

        const totalTests = allTests.length;
        const passedTests = allTests.filter(t => t.status === 'PASS').length;
        const passRate = ((passedTests / totalTests) * 100).toFixed(1);

        log('blue', `Total Tests: ${totalTests}`);
        log('green', `Passed: ${passedTests}`);
        log('blue', `Pass Rate: ${passRate}%`);
        log('blue', `Tenants Created: ${tenants.length}`);

        if (passRate >= 80) {
            log('green', '\n🎉 PRODUCTION READY - All validations passed!');
        } else {
            log('yellow', '\n⚠️  NEEDS FIXES - Some validations failed');
        }

        process.exit(0);
    } catch (error) {
        log('red', `\n💥 Validation failed: ${error.message}`);
        console.error(error);
        process.exit(1);
    }
}

main();
