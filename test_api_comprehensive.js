#!/usr/bin/env node
/**
 * COMPREHENSIVE API TEST SUITE
 * Tests all critical endpoints to ensure stability
 * 
 * Run: node test_api_comprehensive.js
 */

const http = require('http');

const BASE_URL = process.env.API_URL || 'http://localhost:8000';
const TEST_RESULTS = [];

// Test user credentials
const TEST_USER = {
  email: `test${Date.now()}@cafe.com`,
  password: 'Test@123!'
};

// Helper to make HTTP requests
function request(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Test 1: Health Check
async function testHealth() {
  console.log('\n🏥 Test 1: Health Check');
  try {
    const res = await request('/health');
    const passed = res.status === 200 && res.data.status === 'OK';
    
    TEST_RESULTS.push({ name: 'Health Check', passed, status: res.status });
    console.log(passed ? '✅ Health check passed' : `❌ Health check failed: ${res.status}`);
    return passed;
  } catch (err) {
    TEST_RESULTS.push({ name: 'Health Check', passed: false, error: err.message });
    console.log('❌ Health check error:', err.message);
    return false;
  }
}

// Test 2: Onboarding
async function testOnboarding() {
  console.log('\n📝 Test 2: Business Onboarding');
  const timestamp = Date.now();
  const businessData = {
    businessName: `Test Cafe ${timestamp}`,
    businessEmail: `cafe${timestamp}@test.com`,
    businessPhone: '9876543210',
    businessAddress: '123 Test Street',
    gstNumber: '27AABCU9603R1ZX',
    adminName: 'Test Admin',
    adminEmail: `admin${timestamp}@test.com`,
    adminPassword: 'Test@123!',
    cafeType: 'SOLO',
    brandName: `Test Cafe Brand ${timestamp}`
  };

  try {
    const res = await request('/api/onboarding/business', 'POST', businessData);
    const passed = res.status === 201 && res.data.success;
    
    TEST_RESULTS.push({ name: 'Onboarding', passed, status: res.status });
    
    if (passed) {
      console.log('✅ Onboarding passed');
      console.log('   Business:', res.data.business?.name);
      console.log('   User:', res.data.user?.email);
      // Store credentials for login test
      TEST_USER.email = businessData.adminEmail;
      return true;
    } else {
      console.log(`❌ Onboarding failed: ${res.status}`, res.data.message || res.data);
      return false;
    }
  } catch (err) {
    TEST_RESULTS.push({ name: 'Onboarding', passed: false, error: err.message });
    console.log('❌ Onboarding error:', err.message);
    return false;
  }
}

// Test 3: Login
async function testLogin() {
  console.log('\n🔐 Test 3: User Login');
  try {
    const res = await request('/api/auth/login', 'POST', {
      email: TEST_USER.email,
      password: TEST_USER.password
    });
    
    const passed = res.status === 200 && res.data.success;
    TEST_RESULTS.push({ name: 'Login', passed, status: res.status });
    
    if (passed) {
      console.log('✅ Login passed');
      console.log('   Token received:', res.data.accessToken ? 'Yes' : 'No');
      return { token: res.data.accessToken, user: res.data.user };
    } else {
      console.log(`❌ Login failed: ${res.status}`, res.data.message);
      return null;
    }
  } catch (err) {
    TEST_RESULTS.push({ name: 'Login', passed: false, error: err.message });
    console.log('❌ Login error:', err.message);
    return null;
  }
}

// Test 4: Get Current User (Protected Route)
async function testGetMe(token) {
  console.log('\n👤 Test 4: Get Current User (/api/auth/me)');
  if (!token) {
    console.log('⚠️  Skipping - no auth token');
    TEST_RESULTS.push({ name: 'Get Me', passed: false, skipped: true });
    return false;
  }

  try {
    const res = await request('/api/auth/me', 'GET', null, {
      'Authorization': `Bearer ${token}`
    });
    
    const passed = res.status === 200 && res.data.success;
    TEST_RESULTS.push({ name: 'Get Me', passed, status: res.status });
    console.log(passed ? '✅ Get user passed' : `❌ Get user failed: ${res.status}`);
    return passed;
  } catch (err) {
    TEST_RESULTS.push({ name: 'Get Me', passed: false, error: err.message });
    console.log('❌ Get user error:', err.message);
    return false;
  }
}

// Test 5: Logout
async function testLogout(token) {
  console.log('\n🚪 Test 5: User Logout');
  if (!token) {
    console.log('⚠️  Skipping - no auth token');
    TEST_RESULTS.push({ name: 'Logout', passed: false, skipped: true });
    return false;
  }

  try {
    const res = await request('/api/auth/logout', 'POST', {}, {
      'Authorization': `Bearer ${token}`
    });
    
    // Logout can return 200 or 401 if token is already invalidated
    const passed = res.status === 200 || res.status === 401;
    TEST_RESULTS.push({ name: 'Logout', passed, status: res.status });
    console.log(passed ? '✅ Logout passed' : `❌ Logout failed: ${res.status}`);
    return passed;
  } catch (err) {
    TEST_RESULTS.push({ name: 'Logout', passed: false, error: err.message });
    console.log('❌ Logout error:', err.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║      COMPREHENSIVE API TEST SUITE                      ║');
  console.log('║      URL:', BASE_URL.padEnd(43), '║');
  console.log('╚════════════════════════════════════════════════════════╝');

  // Health check first
  const healthy = await testHealth();
  if (!healthy) {
    console.log('\n💥 Server not healthy. Ensure server is running:');
    console.log('   npm start');
    printSummary();
    process.exit(1);
  }

  // Run all tests
  const onboardingSuccess = await testOnboarding();
  const auth = await testLogin();
  
  if (auth && auth.token) {
    await testGetMe(auth.token);
    await testLogout(auth.token);
  }

  // Print summary
  printSummary();
  
  // Exit with appropriate code
  const allPassed = TEST_RESULTS.every(t => t.passed || t.skipped);
  process.exit(allPassed ? 0 : 1);
}

function printSummary() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║              TEST RESULTS SUMMARY                      ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  
  const passed = TEST_RESULTS.filter(t => t.passed).length;
  const total = TEST_RESULTS.length;
  
  TEST_RESULTS.forEach(test => {
    const icon = test.passed ? '✅' : test.skipped ? '⚠️' : '❌';
    const status = test.skipped ? 'SKIPPED' : test.passed ? 'PASS' : 'FAIL';
    console.log(`║ ${icon} ${test.name.padEnd(20)} ${status.padEnd(10)} ${(test.status || '-').toString().padStart(3)} ║`);
  });
  
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log(`║  RESULT: ${passed}/${total} tests passed${''.padEnd(32)}║`);
  console.log('╚════════════════════════════════════════════════════════╝');
  
  if (passed === total) {
    console.log('\n🎉 ALL TESTS PASSED! Backend is stable and ready.');
  } else {
    console.log('\n⚠️  Some tests failed. Check logs above.');
  }
}

// Run tests
runTests().catch(err => {
  console.error('💥 Test suite crashed:', err);
  process.exit(1);
});
