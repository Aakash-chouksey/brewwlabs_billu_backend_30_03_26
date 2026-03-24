/**
 * ONBOARDING API TEST SUITE
 * Comprehensive testing of business onboarding endpoint
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:8000';

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, status, details = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${name}`);
  if (details) console.log(`   ${details}`);
  results.tests.push({ name, status, details });
  if (status === 'PASS') results.passed++;
  if (status === 'FAIL') results.failed++;
}

// Generate unique test data
const timestamp = Date.now();
const testData = {
  valid: {
    businessName: `Test Cafe ${timestamp}`,
    businessEmail: `testcafe_${timestamp}@brewlabs.com`,
    businessPhone: '+1234567890',
    businessAddress: '123 Test Street, Test City',
    gstNumber: 'GST123456',
    adminName: 'Test Admin',
    adminEmail: `admin_${timestamp}@brewlabs.com`,
    adminPassword: 'TestPassword123!',
    cafeType: 'SOLO',
    brandName: 'Test Brand'
  },
  missingFields: {
    businessName: '',
    businessEmail: '',
    adminName: '',
    adminEmail: '',
    adminPassword: ''
  },
  invalidEmail: {
    businessName: 'Test Cafe',
    businessEmail: 'invalid-email',
    adminName: 'Test Admin',
    adminEmail: 'also-invalid',
    adminPassword: 'TestPass123!'
  }
};

// ============================================
// ONBOARDING TESTS
// ============================================

async function testHealthCheck() {
  try {
    console.log('\n🏥 TEST 1: Health Check\n');
    const response = await axios.get(`${BASE_URL}/health`, {
      validateStatus: () => true,
      timeout: 5000
    });
    
    if (response.status === 200) {
      logTest('Health Check', 'PASS', `Status: ${response.status}`);
      return true;
    } else {
      logTest('Health Check', 'FAIL', `Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logTest('Health Check', 'FAIL', `Error: ${error.message}`);
    return false;
  }
}

async function testOnboardingSuccess() {
  try {
    console.log('\n🚀 TEST 2: Onboarding - Success Case\n');
    
    const response = await axios.post(`${BASE_URL}/api/onboarding/business`, testData.valid, {
      validateStatus: () => true,
      timeout: 60000 // 60s timeout for onboarding
    });
    
    if (response.status === 201) {
      const data = response.data;
      
      // Validate response structure
      const checks = [
        { check: data.success === true, msg: 'success flag' },
        { check: data.accessToken, msg: 'accessToken present' },
        { check: data.refreshToken, msg: 'refreshToken present' },
        { check: data.business?.id, msg: 'business.id present' },
        { check: data.outlet?.id, msg: 'outlet.id present' },
        { check: data.user?.id, msg: 'user.id present' },
        { check: data.user?.email === testData.valid.adminEmail, msg: 'user email matches' }
      ];
      
      const failedChecks = checks.filter(c => !c.check);
      
      if (failedChecks.length === 0) {
        logTest('Onboarding Success', 'PASS', 
          `Status: ${response.status}, Business: ${data.business?.name}, Duration: ${data.duration}ms`);
        return {
          businessId: data.business?.id,
          adminId: data.user?.id,
          accessToken: data.accessToken
        };
      } else {
        logTest('Onboarding Success', 'FAIL', 
          `Missing fields: ${failedChecks.map(c => c.msg).join(', ')}`);
        return null;
      }
    } else if (response.status === 500) {
      logTest('Onboarding Success', 'FAIL', 
        `Server Error 500: ${JSON.stringify(response.data).substring(0, 200)}`);
      return null;
    } else if (response.status === 409) {
      logTest('Onboarding Success', 'FAIL', 
        `Conflict 409: Business or user already exists`);
      return null;
    } else {
      logTest('Onboarding Success', 'FAIL', 
        `Unexpected status: ${response.status}, Response: ${JSON.stringify(response.data).substring(0, 200)}`);
      return null;
    }
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      logTest('Onboarding Success', 'FAIL', 'Request timeout (>60s)');
    } else if (error.code === 'ECONNREFUSED') {
      logTest('Onboarding Success', 'FAIL', 'Connection refused - server not running');
    } else {
      logTest('Onboarding Success', 'FAIL', `Error: ${error.message}`);
    }
    return null;
  }
}

async function testOnboardingDuplicate() {
  try {
    console.log('\n🚀 TEST 3: Onboarding - Duplicate Business\n');
    
    const response = await axios.post(`${BASE_URL}/api/onboarding/business`, testData.valid, {
      validateStatus: () => true,
      timeout: 30000
    });
    
    if (response.status === 409 || response.status === 400) {
      logTest('Onboarding Duplicate', 'PASS', 
        `Status: ${response.status}, Duplicate correctly rejected`);
    } else if (response.status === 201) {
      logTest('Onboarding Duplicate', 'WARNING', 
        `Status: ${response.status}, Duplicate was allowed (may be intentional)`);
    } else {
      logTest('Onboarding Duplicate', 'FAIL', 
        `Unexpected status: ${response.status}`);
    }
  } catch (error) {
    logTest('Onboarding Duplicate', 'FAIL', `Error: ${error.message}`);
  }
}

async function testOnboardingMissingFields() {
  try {
    console.log('\n🚀 TEST 4: Onboarding - Missing Fields\n');
    
    const response = await axios.post(`${BASE_URL}/api/onboarding/business`, testData.missingFields, {
      validateStatus: () => true,
      timeout: 10000
    });
    
    if (response.status === 400) {
      logTest('Onboarding Missing Fields', 'PASS', 
        `Status: ${response.status}, Validation working`);
    } else {
      logTest('Onboarding Missing Fields', 'FAIL', 
        `Expected 400, got ${response.status}`);
    }
  } catch (error) {
    logTest('Onboarding Missing Fields', 'FAIL', `Error: ${error.message}`);
  }
}

async function testOnboardingInvalidEmail() {
  try {
    console.log('\n🚀 TEST 5: Onboarding - Invalid Email\n');
    
    const response = await axios.post(`${BASE_URL}/api/onboarding/business`, testData.invalidEmail, {
      validateStatus: () => true,
      timeout: 10000
    });
    
    if (response.status === 400) {
      logTest('Onboarding Invalid Email', 'PASS', 
        `Status: ${response.status}, Email validation working`);
    } else {
      logTest('Onboarding Invalid Email', 'FAIL', 
        `Expected 400, got ${response.status}`);
    }
  } catch (error) {
    logTest('Onboarding Invalid Email', 'FAIL', `Error: ${error.message}`);
  }
}

async function testOnboardedUserLogin(onboardedData) {
  if (!onboardedData) {
    logTest('Onboarded User Login', 'SKIP', 'No onboarded user data available');
    return;
  }
  
  try {
    console.log('\n🔐 TEST 6: Login with Onboarded User\n');
    
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: testData.valid.adminEmail,
      password: testData.valid.adminPassword
    }, {
      validateStatus: () => true,
      timeout: 10000
    });
    
    if (response.status === 200 && response.data.accessToken) {
      logTest('Onboarded User Login', 'PASS', 
        `Status: ${response.status}, Token received`);
    } else if (response.status === 401) {
      logTest('Onboarded User Login', 'FAIL', 
        `Status: 401 - User may not be fully activated`);
    } else {
      logTest('Onboarded User Login', 'FAIL', 
        `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Onboarded User Login', 'FAIL', `Error: ${error.message}`);
  }
}

async function testProtectedRouteWithOnboardedToken(onboardedData) {
  if (!onboardedData?.accessToken) {
    logTest('Protected Route Access', 'SKIP', 'No access token available');
    return;
  }
  
  try {
    console.log('\n🔑 TEST 7: Access Protected Route with Onboarded Token\n');
    
    // Use /api/tenant/business which is a simple endpoint without complex associations
    const response = await axios.get(`${BASE_URL}/api/tenant/business`, {
      headers: { 'Authorization': `Bearer ${onboardedData.accessToken}` },
      validateStatus: () => true,
      timeout: 10000
    });
    
    if (response.status === 200) {
      logTest('Protected Route Access', 'PASS', 
        `Status: ${response.status}, Tenant data accessible`);
    } else if (response.status === 401) {
      logTest('Protected Route Access', 'FAIL', 
        `Status: 401 - Token invalid or expired`);
    } else if (response.status === 403) {
      logTest('Protected Route Access', 'FAIL', 
        `Status: 403 - Access denied`);
    } else {
      logTest('Protected Route Access', 'FAIL', 
        `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Protected Route Access', 'FAIL', `Error: ${error.message}`);
  }
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function runAllTests() {
  console.log('\n========================================');
  console.log('🚀 ONBOARDING API TEST SUITE');
  console.log('========================================\n');
  console.log(`Testing against: ${BASE_URL}`);
  console.log('');
  
  // Check server health first
  const isHealthy = await testHealthCheck();
  if (!isHealthy) {
    console.log('\n❌ Server is not healthy. Aborting tests.');
    process.exit(1);
  }
  
  // Run onboarding tests
  const onboardedData = await testOnboardingSuccess();
  await testOnboardingDuplicate();
  await testOnboardingMissingFields();
  await testOnboardingInvalidEmail();
  
  // Test with onboarded user
  await testOnboardedUserLogin(onboardedData);
  await testProtectedRouteWithOnboardedToken(onboardedData);
  
  // Summary
  console.log('\n========================================');
  console.log('📊 TEST SUMMARY');
  console.log('========================================');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⚠️  Skipped: ${results.tests.filter(t => t.status === 'SKIP').length}`);
  console.log(`\nTotal: ${results.tests.length} tests`);
  
  const passRate = ((results.passed / results.tests.length) * 100).toFixed(1);
  console.log(`\nPass Rate: ${passRate}%`);
  
  // List failed tests
  const failedTests = results.tests.filter(t => t.status === 'FAIL');
  if (failedTests.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    failedTests.forEach(t => console.log(`   - ${t.name}: ${t.details}`));
  }
  
  // Final verdict
  console.log('\n========================================');
  if (results.failed === 0 && results.passed > 0) {
    console.log('🎉 ALL TESTS PASSED');
    console.log('✅ Onboarding API is working properly');
    process.exit(0);
  } else if (results.failed > 0) {
    console.log('⚠️  SOME TESTS FAILED');
    console.log('❌ Review and fix issues above');
    process.exit(1);
  } else {
    console.log('⚠️  NO TESTS COMPLETED');
    process.exit(1);
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled error:', error.message);
  process.exit(1);
});

// Run tests
runAllTests().catch(error => {
  console.error('\n❌ Test runner failed:', error);
  process.exit(1);
});
