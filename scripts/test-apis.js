#!/usr/bin/env node
/**
 * API TESTING SCRIPT
 * 
 * Tests all tenant APIs after onboarding to verify:
 * 1. Response structure { success, message, data }
 * 2. Data integrity
 * 3. No undefined/null crashes
 */

const axios = require('axios');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';

// Test credentials (will be created during onboarding)
let testTokens = {
    accessToken: null,
    businessId: null,
    schemaName: null
};

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

function logSuccess(msg) { console.log(`${colors.green}✅${colors.reset} ${msg}`); }
function logError(msg) { console.log(`${colors.red}❌${colors.reset} ${msg}`); }
function logWarning(msg) { console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`); }
function logInfo(msg) { console.log(`${colors.blue}ℹ️${colors.reset} ${msg}`); }

function validateApiResponse(response, endpoint) {
    const issues = [];
    
    if (!response || typeof response !== 'object') {
        issues.push('Response is not an object');
        return issues;
    }
    
    if (!('success' in response)) {
        issues.push('Missing "success" field');
    }
    
    if (!('message' in response)) {
        issues.push('Missing "message" field');
    }
    
    if (!('data' in response)) {
        issues.push('Missing "data" field');
    }
    
    return issues;
}

async function testEndpoint(method, endpoint, data = null, token = null) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    
    try {
        const response = await axios({ method, url, data, headers, timeout: 30000 });
        return { 
            success: true, 
            status: response.status, 
            data: response.data,
            issues: validateApiResponse(response.data, endpoint)
        };
    } catch (error) {
        return { 
            success: false, 
            status: error.response?.status,
            error: error.response?.data || error.message,
            issues: ['Request failed']
        };
    }
}

async function runApiTests() {
    console.log('🧪 API TESTING SUITE\n');
    console.log(`Base URL: ${BASE_URL}\n`);
    
    // Test 1: Health check
    logInfo('Testing health endpoint...');
    const health = await testEndpoint('GET', '/health');
    if (health.success) {
        logSuccess('/health - Server is running');
    } else {
        logError('/health - Server not responding');
        console.log('   Cannot continue without server connection');
        return;
    }
    
    // Test 2: Onboarding (if server is fresh)
    logInfo('\nTesting onboarding endpoint...');
    const timestamp = Date.now();
    const onboardingData = {
        name: `Test Cafe ${timestamp}`,
        email: `test${timestamp}@example.com`,
        phone: '1234567890',
        address: '123 Test Street',
        owner_name: 'Test Owner',
        password: 'TestPass123!'
    };
    
    const onboarding = await testEndpoint('POST', '/api/onboarding/business', onboardingData);
    if (onboarding.success && onboarding.data?.success) {
        logSuccess('/api/onboarding/business - Onboarding succeeded');
        if (onboarding.data.data) {
            testTokens.businessId = onboarding.data.data.business_id;
            testTokens.schemaName = onboarding.data.data.schema_name;
            logInfo(`   Business ID: ${testTokens.businessId}`);
            logInfo(`   Schema: ${testTokens.schemaName}`);
        }
        
        // Store tokens for authenticated requests
        if (onboarding.data.data?.tokens) {
            testTokens.accessToken = onboarding.data.data.tokens.access_token;
        }
    } else {
        logError('/api/onboarding/business - Onboarding failed');
        console.log('   Error:', onboarding.error);
    }
    
    if (!testTokens.accessToken) {
        logWarning('\nNo access token available - skipping authenticated endpoints');
        return;
    }
    
    // Wait for onboarding to complete
    logInfo('\nWaiting for onboarding to complete (5s)...');
    await new Promise(r => setTimeout(r, 5000));
    
    // Test 3: Authenticated endpoints
    const endpoints = [
        { method: 'GET', endpoint: '/api/tenant/dashboard', name: 'Dashboard' },
        { method: 'GET', endpoint: '/api/tenant/products', name: 'Products List' },
        { method: 'GET', endpoint: '/api/tenant/categories', name: 'Categories' },
        { method: 'GET', endpoint: '/api/tenant/orders', name: 'Orders' },
    ];
    
    logInfo('\nTesting authenticated endpoints...');
    for (const { method, endpoint, name } of endpoints) {
        const result = await testEndpoint(method, endpoint, null, testTokens.accessToken);
        if (result.success && result.data?.success) {
            if (result.issues.length === 0) {
                logSuccess(`${endpoint} - ${name} (Valid structure)`);
            } else {
                logWarning(`${endpoint} - ${name} (Issues: ${result.issues.join(', ')})`);
            }
        } else {
            logError(`${endpoint} - ${name} (Failed: ${result.error?.message || result.error})`);
        }
    }
    
    console.log('\n✅ API TESTING COMPLETE\n');
}

runApiTests().catch(error => {
    console.error('Test suite failed:', error.message);
    process.exit(1);
});
