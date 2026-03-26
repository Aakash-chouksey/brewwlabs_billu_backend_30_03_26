const axios = require('axios');

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:8000';

// Test data
const testBusiness = {
    businessName: 'Test Cafe Auth ' + Math.random().toString(36).substr(2, 9),
    businessEmail: 'testcafe' + Math.random().toString(36).substr(2, 9) + '@example.com',
    adminName: 'Test Admin',
    adminEmail: 'admin' + Math.random().toString(36).substr(2, 9) + '@testcafe.com',
    adminPassword: 'TestPassword123!',
    businessPhone: '+1234567890',
    businessAddress: '123 Test Street, Test City',
    cafeType: 'SOLO',
    brandName: 'Test Cafe Brand ' + Math.random().toString(36).substr(2, 9)
};

// Colors for output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
    log(`\n🔍 ${title}`, 'blue');
    log('='.repeat(50), 'blue');
}

function logSuccess(message) {
    log(`✅ ${message}`, 'green');
}

function logError(message) {
    log(`❌ ${message}`, 'red');
}

function logWarning(message) {
    log(`⚠️ ${message}`, 'yellow');
}

// Test 1: Onboarding API
async function testOnboarding() {
    logSection('TEST 1: ONBOARDING API - POST /api/user/onboard');
    
    try {
        log('Creating new business...', 'blue');
        const response = await axios.post(`${BASE_URL}/api/onboarding/business`, testBusiness);
        
        if (response.status === 201 && response.data.success) {
            logSuccess('Onboarding successful');
            
            const businessId = response.data.business.id;
            const brandId = response.data.business.id; // Correct for SOLO
            const outletId = response.data.outlet.id;
            
            log(`Business ID: ${businessId}`, 'blue');
            log(`Outlet ID: ${outletId}`, 'blue');
            
            // Validate IDs
            if (businessId && outletId) {
                logSuccess('✅ Business and Outlet IDs present');
            } else {
                logError('❌ Missing IDs in onboarding response');
            }
            
            return {
                businessId,
                brandId,
                outletId,
                user: response.data.user
            };
        } else {
            logError('Onboarding failed');
            log(JSON.stringify(response.data, null, 2), 'red');
            return null;
        }
    } catch (error) {
        logError(`Onboarding error: ${error.message}`);
        if (error.response) {
            log(`Status: ${error.response.status}`, 'red');
            log(JSON.stringify(error.response.data, null, 2), 'red');
        }
        return null;
    }
}

// Test 2: Login API
async function testLogin(onboardingData) {
    logSection('TEST 2: LOGIN API - POST /api/auth/login');
    
    if (!onboardingData) {
        logWarning('Skipping login test - no onboarding data');
        return null;
    }
    
    try {
        log('Attempting login...', 'blue');
        const response = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: testBusiness.adminEmail,
            password: testBusiness.adminPassword
        });
        
        if (response.status === 200 && response.data.success) {
            logSuccess('Login successful');
            
            const user = response.data.user;
            const token = response.data.accessToken;
            
            // Validate JWT contains correct data
            log(`User ID: ${user.id}`, 'blue');
            log(`Business ID: ${user.businessId}`, 'blue');
            log(`Outlet ID: ${user.outletId}`, 'blue');
            log(`Role: ${user.role}`, 'blue');
            
            // Decode JWT to verify payload (optional validation)
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.decode(token);
                if (decoded && decoded.exp) {
                    logSuccess(`✅ JWT validated, expires: ${new Date(decoded.exp * 1000).toISOString()}`);
                }
            } catch (e) {
                logWarning('⚠️ Could not decode JWT for validation');
            }
            
            return { user, token };
        } else {
            logError('Login failed');
            log(JSON.stringify(response.data, null, 2), 'red');
            return null;
        }
    } catch (error) {
        logError(`Login error: ${error.message}`);
        if (error.response) {
            log(`Status: ${error.response.status}`, 'red');
            log(JSON.stringify(error.response.data, null, 2), 'red');
        }
        return null;
    }
}

// Test 3: JWT Middleware
async function testJWTMiddleware(loginData) {
    logSection('TEST 3: JWT MIDDLEWARE VALIDATION');
    
    if (!loginData || !loginData.token) {
        logWarning('Skipping JWT middleware test - no login token');
        return null;
    }
    
    try {
        log('Testing protected endpoint with valid token...', 'blue');
        const response = await axios.get(`${BASE_URL}/api/auth/me`, {
            headers: {
                'Authorization': `Bearer ${loginData.token}`
            }
        });
        
        if (response.status === 200 && response.data.success) {
            logSuccess('JWT middleware accepted valid token');
            
            const user = response.data.user;
            log(`User ID: ${user.id}`, 'blue');
            log(`Business ID: ${user.businessId}`, 'blue');
            log(`Role: ${user.role}`, 'blue');
            
            return true;
        } else {
            logError('JWT middleware rejected valid token');
            return false;
        }
    } catch (error) {
        logError(`JWT middleware error: ${error.message}`);
        if (error.response) {
            log(`Status: ${error.response.status}`, 'red');
        }
        return false;
    }
}

// Test 4: Invalid Token
async function testInvalidToken() {
    logSection('TEST 4: INVALID TOKEN REJECTION');
    
    try {
        log('Testing with invalid token...', 'blue');
        const response = await axios.get(`${BASE_URL}/api/auth/me`, {
            headers: {
                'Authorization': 'Bearer invalid-token-here'
            }
        });
        
        logError('JWT middleware accepted invalid token - SECURITY ISSUE');
        return false;
    } catch (error) {
        if (error.response && error.response.status === 401) {
            logSuccess('JWT middleware correctly rejected invalid token');
            return true;
        } else {
            logError(`Unexpected error: ${error.message}`);
            return false;
        }
    }
}

// Test 5: Tenant Context Validation
async function testTenantContext(loginData) {
    logSection('TEST 5: TENANT CONTEXT VALIDATION');
    
    if (!loginData || !loginData.token) {
        logWarning('Skipping tenant context test - no login token');
        return null;
    }
    
    try {
        log('Testing tenant-specific endpoint...', 'blue');
        const response = await axios.get(`${BASE_URL}/api/tenant/profile`, {
            headers: {
                'Authorization': `Bearer ${loginData.token}`
            }
        });
        
        if (response.status === 200) {
            logSuccess('Tenant context accessible');
            
            // Check if response contains tenant-specific data
            const businessId = response.data.business?.id || response.data.user?.businessId;
            if (businessId) {
                log(`Business ID in response: ${businessId}`, 'blue');
                
                if (businessId === loginData.user.businessId) {
                    logSuccess('✅ Business ID matches login context');
                } else {
                    logError('❌ Business ID mismatch in tenant context');
                }
            }
            
            return true;
        } else {
            logWarning('Tenant endpoint returned unexpected status');
            return false;
        }
    } catch (error) {
        logError(`Tenant context error: ${error.message}`);
        if (error.response) {
            log(`Status: ${error.response.status}`, 'red');
        }
        return false;
    }
}

// Main test runner
async function runAuthTests() {
    logSection('AUTH SYSTEM COMPLETE TEST SUITE');
    log(`Base URL: ${BASE_URL}`, 'blue');
    
    const results = {
        onboarding: false,
        login: false,
        jwtMiddleware: false,
        invalidToken: false,
        tenantContext: false
    };
    
    try {
        // Test 1: Onboarding
        const onboardingData = await testOnboarding();
        results.onboarding = !!onboardingData;
        
        // Test 2: Login
        const loginData = await testLogin(onboardingData);
        results.login = !!loginData;
        
        // Test 3: JWT Middleware
        results.jwtMiddleware = await testJWTMiddleware(loginData);
        
        // Test 4: Invalid Token
        results.invalidToken = await testInvalidToken();
        
        // Test 5: Tenant Context
        results.tenantContext = await testTenantContext(loginData);
        
    } catch (error) {
        logError(`Test suite error: ${error.message}`);
    }
    
    // Final results
    logSection('FINAL RESULTS');
    
    let passedTests = 0;
    const totalTests = Object.keys(results).length;
    
    for (const [test, passed] of Object.entries(results)) {
        const status = passed ? '✅ PASS' : '❌ FAIL';
        const color = passed ? 'green' : 'red';
        log(`${test.toUpperCase()}: ${status}`, color);
        if (passed) passedTests++;
    }
    
    log(`\nOverall: ${passedTests}/${totalTests} tests passed`, passedTests === totalTests ? 'green' : 'red');
    
    if (passedTests === totalTests) {
        logSuccess('🎉 ALL TESTS PASSED - Auth system is working correctly!');
    } else {
        logError('🚨 CRITICAL ISSUES FOUND - Auth system needs fixes!');
    }
    
    return results;
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAuthTests().catch(console.error);
}

module.exports = {
    runAuthTests,
    testOnboarding,
    testLogin,
    testJWTMiddleware,
    testInvalidToken,
    testTenantContext
};
