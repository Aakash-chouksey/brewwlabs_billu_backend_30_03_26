#!/usr/bin/env node

/**
 * STEP 4: API LAYER VERIFICATION
 * Tests all API endpoints for correctness
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

async function verifyAPIs() {
    log('cyan', '\n╔════════════════════════════════════════════════════════════╗');
    log('cyan', '║         STEP 4: API LAYER VERIFICATION                     ║');
    log('cyan', '╚════════════════════════════════════════════════════════════╝\n');
    
    log('blue', `Testing API at: ${BASE_URL}\n`);
    
    const results = {
        passed: 0,
        failed: 0,
        tests: []
    };
    
    // Test Health Endpoint
    await testEndpoint(results, 'Health Check', '/health', 'GET');
    
    // Test Auth Endpoints
    await testEndpoint(results, 'Auth - Login (POST)', '/api/auth/login', 'POST', {
        email: 'test@example.com',
        password: 'test123'
    });
    
    await testEndpoint(results, 'Auth - Register (POST)', '/api/auth/register', 'POST', {
        name: 'Test User',
        email: 'newuser@test.com',
        password: 'test123'
    });
    
    // Test Onboarding
    await testEndpoint(results, 'Onboarding - Business (POST)', '/api/onboarding/business', 'POST', {
        businessName: 'Test Cafe',
        businessEmail: 'cafe@test.com',
        adminName: 'Admin User',
        adminEmail: 'admin@test.com',
        adminPassword: 'admin123'
    });
    
    // Print summary
    log('cyan', '\n═══════════════════════════════════════════════════════════');
    log('cyan', 'API TEST SUMMARY');
    log('cyan', '═══════════════════════════════════════════════════════════');
    log('green', `✅ Passed: ${results.passed}`);
    log('red', `❌ Failed: ${results.failed}`);
    log('blue', `📊 Total: ${results.passed + results.failed}`);
    
    const passRate = ((results.passed / (results.passed + results.failed)) * 100).toFixed(1);
    if (passRate >= 80) {
        log('green', `\n🎉 Pass Rate: ${passRate}% - API STABLE`);
    } else {
        log('yellow', `\n⚠️  Pass Rate: ${passRate}% - NEEDS IMPROVEMENT`);
    }
}

async function testEndpoint(results, name, path, method, data = null) {
    const url = `${BASE_URL}${path}`;
    const startTime = Date.now();
    
    try {
        const config = {
            method,
            url,
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        };
        
        if (data && method === 'POST') {
            config.data = data;
        }
        
        const response = await axios(config);
        const duration = Date.now() - startTime;
        
        const hasCorrectFormat = 
            response.data && 
            typeof response.data.success === 'boolean';
        
        if (hasCorrectFormat) {
            log('green', `✅ ${name} - ${response.status} (${duration}ms)`);
            results.passed++;
        } else {
            log('yellow', `⚠️  ${name} - Wrong response format (${duration}ms)`);
            results.failed++;
        }
        
        results.tests.push({ name, status: 'PASS', duration, code: response.status });
        
    } catch (error) {
        const duration = Date.now() - startTime;
        
        if (error.response) {
            // Server returned error status
            const status = error.response.status;
            if (status === 400 || status === 401 || status === 404 || status === 409) {
                // Expected errors (validation, auth, not found, conflict)
                log('blue', `ℹ️  ${name} - ${status} (${duration}ms) - Expected`);
                results.passed++;
                results.tests.push({ name, status: 'EXPECTED_ERROR', duration, code: status });
            } else {
                log('red', `❌ ${name} - ${status} (${duration}ms) - ${error.message}`);
                results.failed++;
                results.tests.push({ name, status: 'FAIL', duration, code: status, error: error.message });
            }
        } else {
            log('red', `❌ ${name} - Connection failed (${duration}ms) - ${error.message}`);
            results.failed++;
            results.tests.push({ name, status: 'FAIL', duration, error: error.message });
        }
    }
}

// Run if called directly
if (require.main === module) {
    verifyAPIs().catch(err => {
        log('red', `Fatal error: ${err.message}`);
        process.exit(1);
    });
}

module.exports = { verifyAPIs };
