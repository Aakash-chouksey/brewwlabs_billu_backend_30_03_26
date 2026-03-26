/**
 * API Test Script for Auth and Onboarding
 * Run with: node test_api.js
 */

const http = require('http');

const BASE_URL = process.env.API_URL || 'http://localhost:8000';
const TEST_RESULTS = [];

// Helper function to make HTTP requests
function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Test health endpoint
async function testHealth() {
  console.log('🏥 Testing health endpoint...');
  try {
    const response = await makeRequest('/health');
    if (response.status === 200 && response.data.status === 'OK') {
      console.log('✅ Health check passed');
      TEST_RESULTS.push({ test: 'Health', passed: true });
      return true;
    } else {
      console.log('❌ Health check failed:', response.data);
      TEST_RESULTS.push({ test: 'Health', passed: false });
      return false;
    }
  } catch (error) {
    console.log('❌ Health check error:', error.message);
    TEST_RESULTS.push({ test: 'Health', passed: false, error: error.message });
    return false;
  }
}

// Test login endpoint
async function testLogin() {
  console.log('\n🔐 Testing login endpoint...');
  try {
    const response = await makeRequest('/api/auth/login', 'POST', {
      email: 'admin@testcafe.com',
      password: 'Test@123'
    });
    
    if (response.status === 200 && response.data.success) {
      console.log('✅ Login test passed');
      TEST_RESULTS.push({ test: 'Login', passed: true });
      return response.data;
    } else {
      console.log('⚠️  Login failed (expected if user does not exist):', response.data.message);
      TEST_RESULTS.push({ test: 'Login', passed: false, note: 'User may not exist' });
      return null;
    }
  } catch (error) {
    console.log('❌ Login test error:', error.message);
    TEST_RESULTS.push({ test: 'Login', passed: false, error: error.message });
    return null;
  }
}

// Test onboarding endpoint
async function testOnboarding() {
  console.log('\n📝 Testing onboarding endpoint...');
  const timestamp = Date.now();
  const businessData = {
    businessName: `Test Cafe ${timestamp}`,
    businessEmail: `cafe${timestamp}@test.com`,
    businessPhone: '9876543210',
    businessAddress: '123 Test Street, Test City',
    gstNumber: '27AABCU9603R1ZX',
    adminName: 'Test Admin',
    adminEmail: `admin${timestamp}@test.com`,
    adminPassword: 'Test@123!',
    cafeType: 'SOLO',
    brandName: `Test Cafe Brand ${timestamp}`
  };

  try {
    const response = await makeRequest('/api/onboarding/business', 'POST', businessData);
    
    if (response.status === 201 && response.data.success) {
      console.log('✅ Onboarding test passed');
      console.log('   Business:', response.data.business.name);
      console.log('   Admin:', response.data.user.email);
      TEST_RESULTS.push({ test: 'Onboarding', passed: true });
      return response.data;
    } else {
      console.log('❌ Onboarding failed:', response.data.message || response.data);
      TEST_RESULTS.push({ test: 'Onboarding', passed: false, error: response.data.message });
      return null;
    }
  } catch (error) {
    console.log('❌ Onboarding test error:', error.message);
    TEST_RESULTS.push({ test: 'Onboarding', passed: false, error: error.message });
    return null;
  }
}

// Test login with newly created user
async function testLoginWithNewUser(adminEmail, adminPassword) {
  console.log('\n🔐 Testing login with newly created user...');
  try {
    const response = await makeRequest('/api/auth/login', 'POST', {
      email: adminEmail,
      password: adminPassword
    });
    
    if (response.status === 200 && response.data.success) {
      console.log('✅ Login with new user passed');
      console.log('   Token received:', response.data.accessToken ? 'Yes' : 'No');
      TEST_RESULTS.push({ test: 'Login (New User)', passed: true });
      return response.data;
    } else {
      console.log('❌ Login with new user failed:', response.data.message);
      TEST_RESULTS.push({ test: 'Login (New User)', passed: false });
      return null;
    }
  } catch (error) {
    console.log('❌ Login with new user error:', error.message);
    TEST_RESULTS.push({ test: 'Login (New User)', passed: false, error: error.message });
    return null;
  }
}

// Run all tests
async function runTests() {
  console.log('=================================');
  console.log('  API Testing Suite');
  console.log('  Base URL:', BASE_URL);
  console.log('=================================\n');

  // Test health first
  const isHealthy = await testHealth();
  if (!isHealthy) {
    console.log('\n⚠️  Server is not healthy. Make sure the server is running on', BASE_URL);
    console.log('   Start server with: npm start');
    process.exit(1);
  }

  // Try to login with existing user
  let loginData = await testLogin();
  
  // If login fails, create a new business via onboarding
  if (!loginData) {
    console.log('\n📝 No existing user found. Creating new business via onboarding...');
    const onboardingData = await testOnboarding();
    
    if (onboardingData) {
      // Try to login with the newly created user
      loginData = await testLoginWithNewUser(
        onboardingData.user.email,
        'Test@123!'
      );
    }
  }

  // Print summary
  console.log('\n=================================');
  console.log('  Test Results Summary');
  console.log('=================================');
  const passed = TEST_RESULTS.filter(t => t.passed).length;
  const total = TEST_RESULTS.length;
  
  TEST_RESULTS.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${result.test}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    if (result.note) {
      console.log(`   Note: ${result.note}`);
    }
  });
  
  console.log(`\n📊 ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('💥 Test suite error:', error);
  process.exit(1);
});
