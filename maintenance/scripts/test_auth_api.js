/**
 * AUTH API TEST SUITE
 * Comprehensive testing of all authentication endpoints
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:8000';

// Test configuration
const TEST_CONFIG = {
  validUser: {
    email: process.env.TEST_EMAIL || 'test@brewlabs.com',
    password: process.env.TEST_PASSWORD || 'testpassword123'
  },
  invalidUser: {
    email: 'invalid@brewlabs.com',
    password: 'wrongpassword'
  },
  nonExistentUser: {
    email: 'nonexistent_user_12345@test.com',
    password: 'test123'
  }
};

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

let authToken = null;
let refreshToken = null;

function logTest(name, status, details = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${name}`);
  if (details) console.log(`   ${details}`);
  results.tests.push({ name, status, details });
  if (status === 'PASS') results.passed++;
  if (status === 'FAIL') results.failed++;
}

// ============================================
// AUTH TESTS
// ============================================

async function testLoginValid() {
  try {
    console.log('\n🔐 TEST 1: Login with Valid Credentials\n');
    
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: TEST_CONFIG.validUser.email,
      password: TEST_CONFIG.validUser.password
    }, {
      validateStatus: () => true
    });
    
    if (response.status === 200 && response.data.success) {
      authToken = response.data.accessToken;
      refreshToken = response.data.refreshToken;
      logTest('Login (Valid)', 'PASS', 
        `Status: ${response.status}, Token received, User: ${response.data.user?.email || 'N/A'}`);
      return true;
    } else {
      logTest('Login (Valid)', 'FAIL', 
        `Status: ${response.status}, Response: ${JSON.stringify(response.data).substring(0, 100)}`);
      return false;
    }
  } catch (error) {
    logTest('Login (Valid)', 'FAIL', `Error: ${error.message}`);
    return false;
  }
}

async function testLoginInvalidPassword() {
  try {
    console.log('\n🔐 TEST 2: Login with Invalid Password\n');
    
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: TEST_CONFIG.validUser.email,
      password: TEST_CONFIG.invalidUser.password
    }, {
      validateStatus: () => true
    });
    
    if (response.status === 401) {
      logTest('Login (Invalid Password)', 'PASS', 
        `Status: ${response.status}, Correctly rejected`);
    } else {
      logTest('Login (Invalid Password)', 'FAIL', 
        `Expected 401, got ${response.status}`);
    }
  } catch (error) {
    logTest('Login (Invalid Password)', 'FAIL', `Error: ${error.message}`);
  }
}

async function testLoginUserNotFound() {
  try {
    console.log('\n🔐 TEST 3: Login with Non-Existent User\n');
    
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: TEST_CONFIG.nonExistentUser.email,
      password: TEST_CONFIG.nonExistentUser.password
    }, {
      validateStatus: () => true
    });
    
    if (response.status === 401) {
      logTest('Login (User Not Found)', 'PASS', 
        `Status: ${response.status}, Correctly rejected`);
    } else {
      logTest('Login (User Not Found)', 'FAIL', 
        `Expected 401, got ${response.status}`);
    }
  } catch (error) {
    logTest('Login (User Not Found)', 'FAIL', `Error: ${error.message}`);
  }
}

async function testLoginMissingFields() {
  try {
    console.log('\n🔐 TEST 4: Login with Missing Fields\n');
    
    // Missing email
    let response = await axios.post(`${BASE_URL}/api/auth/login`, {
      password: 'test123'
    }, { validateStatus: () => true });
    
    if (response.status === 400 || response.status === 422) {
      logTest('Login (Missing Email)', 'PASS', `Status: ${response.status}`);
    } else {
      logTest('Login (Missing Email)', 'FAIL', `Expected 400/422, got ${response.status}`);
    }
    
    // Missing password
    response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'test@test.com'
    }, { validateStatus: () => true });
    
    if (response.status === 400 || response.status === 422) {
      logTest('Login (Missing Password)', 'PASS', `Status: ${response.status}`);
    } else {
      logTest('Login (Missing Password)', 'FAIL', `Expected 400/422, got ${response.status}`);
    }
  } catch (error) {
    logTest('Login (Missing Fields)', 'FAIL', `Error: ${error.message}`);
  }
}

// ============================================
// TOKEN VALIDATION TESTS
// ============================================

async function testAccessWithValidToken() {
  try {
    console.log('\n🔑 TEST 5: Access Protected Route with Valid Token\n');
    
    if (!authToken) {
      logTest('Access (Valid Token)', 'SKIP', 'No valid token available');
      return;
    }
    
    const response = await axios.get(`${BASE_URL}/api/tenant/products`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
      validateStatus: () => true
    });
    
    if (response.status === 200) {
      logTest('Access (Valid Token)', 'PASS', 
        `Status: ${response.status}, Data returned`);
    } else if (response.status === 401) {
      logTest('Access (Valid Token)', 'FAIL', 
        'Token rejected - may be expired or tenant issue');
    } else {
      logTest('Access (Valid Token)', 'FAIL', 
        `Unexpected status: ${response.status}`);
    }
  } catch (error) {
    logTest('Access (Valid Token)', 'FAIL', `Error: ${error.message}`);
  }
}

async function testAccessWithInvalidToken() {
  try {
    console.log('\n🔑 TEST 6: Access with Invalid Token\n');
    
    const response = await axios.get(`${BASE_URL}/api/tenant/products`, {
      headers: { 'Authorization': 'Bearer invalid_token_12345' },
      validateStatus: () => true
    });
    
    if (response.status === 401) {
      logTest('Access (Invalid Token)', 'PASS', 
        `Status: ${response.status}, Correctly blocked`);
    } else {
      logTest('Access (Invalid Token)', 'FAIL', 
        `Expected 401, got ${response.status}`);
    }
  } catch (error) {
    logTest('Access (Invalid Token)', 'FAIL', `Error: ${error.message}`);
  }
}

async function testAccessWithExpiredToken() {
  try {
    console.log('\n🔑 TEST 7: Access with Expired Token\n');
    
    // Create an expired token structure
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InRlc3QiLCJlbWFpbCI6InRlc3RAdGVzdC5jb20iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTYwMDAwMDAxMH0.invalid';
    
    const response = await axios.get(`${BASE_URL}/api/tenant/products`, {
      headers: { 'Authorization': `Bearer ${expiredToken}` },
      validateStatus: () => true
    });
    
    if (response.status === 401) {
      logTest('Access (Expired Token)', 'PASS', 
        `Status: ${response.status}, Correctly rejected`);
    } else {
      logTest('Access (Expired Token)', 'FAIL', 
        `Expected 401, got ${response.status}`);
    }
  } catch (error) {
    logTest('Access (Expired Token)', 'FAIL', `Error: ${error.message}`);
  }
}

async function testAccessWithoutToken() {
  try {
    console.log('\n🔑 TEST 8: Access Without Token\n');
    
    const response = await axios.get(`${BASE_URL}/api/tenant/products`, {
      validateStatus: () => true
    });
    
    if (response.status === 401) {
      logTest('Access (No Token)', 'PASS', 
        `Status: ${response.status}, Correctly blocked`);
    } else {
      logTest('Access (No Token)', 'FAIL', 
        `Expected 401, got ${response.status}`);
    }
  } catch (error) {
    logTest('Access (No Token)', 'FAIL', `Error: ${error.message}`);
  }
}

async function testAccessWithMalformedToken() {
  try {
    console.log('\n🔑 TEST 9: Access with Malformed Token\n');
    
    const response = await axios.get(`${BASE_URL}/api/tenant/products`, {
      headers: { 'Authorization': 'Bearer not_a_valid_token!!!@@@' },
      validateStatus: () => true
    });
    
    if (response.status === 401) {
      logTest('Access (Malformed Token)', 'PASS', 
        `Status: ${response.status}, Correctly rejected`);
    } else {
      logTest('Access (Malformed Token)', 'FAIL', 
        `Expected 401, got ${response.status}`);
    }
  } catch (error) {
    logTest('Access (Malformed Token)', 'FAIL', `Error: ${error.message}`);
  }
}

// ============================================
// REFRESH TOKEN TESTS
// ============================================

async function testRefreshTokenValid() {
  try {
    console.log('\n🔄 TEST 10: Refresh Token with Valid Refresh Token\n');
    
    if (!refreshToken) {
      logTest('Refresh Token (Valid)', 'SKIP', 'No refresh token available');
      return;
    }
    
    const response = await axios.post(`${BASE_URL}/api/auth/refresh`, {
      refreshToken: refreshToken
    }, {
      validateStatus: () => true
    });
    
    if (response.status === 200 && response.data.accessToken) {
      logTest('Refresh Token (Valid)', 'PASS', 
        `Status: ${response.status}, New token received`);
    } else {
      logTest('Refresh Token (Valid)', 'FAIL', 
        `Status: ${response.status}, No token in response`);
    }
  } catch (error) {
    logTest('Refresh Token (Valid)', 'FAIL', `Error: ${error.message}`);
  }
}

async function testRefreshTokenInvalid() {
  try {
    console.log('\n🔄 TEST 11: Refresh Token with Invalid Token\n');
    
    const response = await axios.post(`${BASE_URL}/api/auth/refresh`, {
      refreshToken: 'invalid_refresh_token_12345'
    }, {
      validateStatus: () => true
    });
    
    if (response.status === 401) {
      logTest('Refresh Token (Invalid)', 'PASS', 
        `Status: ${response.status}, Correctly rejected`);
    } else {
      logTest('Refresh Token (Invalid)', 'FAIL', 
        `Expected 401, got ${response.status}`);
    }
  } catch (error) {
    logTest('Refresh Token (Invalid)', 'FAIL', `Error: ${error.message}`);
  }
}

// ============================================
// LOGOUT TESTS
// ============================================

async function testLogout() {
  try {
    console.log('\n👋 TEST 12: Logout with Valid Token\n');
    
    if (!authToken) {
      logTest('Logout', 'SKIP', 'No valid token available');
      return;
    }
    
    const response = await axios.post(`${BASE_URL}/api/auth/logout`, {}, {
      headers: { 'Authorization': `Bearer ${authToken}` },
      validateStatus: () => true
    });
    
    if (response.status === 200 || response.status === 204) {
      logTest('Logout', 'PASS', 
        `Status: ${response.status}, Successfully logged out`);
    } else {
      logTest('Logout', 'FAIL', 
        `Unexpected status: ${response.status}`);
    }
  } catch (error) {
    logTest('Logout', 'FAIL', `Error: ${error.message}`);
  }
}

// ============================================
// HEALTH CHECK
// ============================================

async function testHealthCheck() {
  try {
    console.log('\n🏥 TEST 13: Health Check\n');
    
    const response = await axios.get(`${BASE_URL}/health`, {
      validateStatus: () => true,
      timeout: 5000
    });
    
    if (response.status === 200) {
      logTest('Health Check', 'PASS', 
        `Status: ${response.status}, Server is healthy`);
    } else {
      logTest('Health Check', 'FAIL', 
        `Unexpected status: ${response.status}`);
    }
  } catch (error) {
    logTest('Health Check', 'FAIL', `Error: ${error.message}`);
  }
}

async function testDetailedHealth() {
  try {
    console.log('\n🏥 TEST 14: Detailed Health Check\n');
    
    const response = await axios.get(`${BASE_URL}/health/detailed`, {
      validateStatus: () => true,
      timeout: 5000
    });
    
    if (response.status === 200 && response.data.status === 'OK') {
      const info = response.data;
      logTest('Detailed Health', 'PASS', 
        `Status: ${response.status}, Version: ${info.version || 'N/A'}`);
    } else {
      logTest('Detailed Health', 'FAIL', 
        `Unexpected status: ${response.status}`);
    }
  } catch (error) {
    logTest('Detailed Health', 'FAIL', `Error: ${error.message}`);
  }
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function runAllTests() {
  console.log('\n========================================');
  console.log('🔒 AUTH API TEST SUITE');
  console.log('========================================\n');
  console.log(`Testing against: ${BASE_URL}`);
  console.log(`Test email: ${TEST_CONFIG.validUser.email}`);
  console.log('');
  
  // Health checks first
  await testHealthCheck();
  await testDetailedHealth();
  
  // Login tests
  const loginSuccess = await testLoginValid();
  await testLoginInvalidPassword();
  await testLoginUserNotFound();
  await testLoginMissingFields();
  
  // Token validation tests
  await testAccessWithValidToken();
  await testAccessWithInvalidToken();
  await testAccessWithExpiredToken();
  await testAccessWithoutToken();
  await testAccessWithMalformedToken();
  
  // Refresh token tests
  await testRefreshTokenValid();
  await testRefreshTokenInvalid();
  
  // Logout test
  await testLogout();
  
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
  
  // Final verdict
  console.log('\n========================================');
  if (results.failed === 0 && results.passed > 0) {
    console.log('🎉 ALL TESTS PASSED');
    console.log('✅ Authentication system is working properly');
    process.exit(0);
  } else if (results.failed === 0 && results.passed === 0) {
    console.log('⚠️  NO TESTS RUN');
    console.log('❌ Server may be unavailable');
    process.exit(1);
  } else {
    console.log('⚠️  SOME TESTS FAILED');
    console.log('❌ Review failures above');
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
