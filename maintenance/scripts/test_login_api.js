/**
 * Login API Test Script
 * Tests the login endpoint comprehensively
 */

const http = require('http');

const BASE_URL = 'localhost';
const PORT = 8000;

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
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

async function runTests() {
  console.log('🔍 Testing Login API...\n');

  // Test 1: Health check
  console.log('Test 1: Health Check');
  const health = await makeRequest('/health');
  console.log(`  Status: ${health.status}`);
  console.log(`  Response: ${JSON.stringify(health.data)}\n`);

  // Test 2: Login with missing credentials
  console.log('Test 2: Login with missing credentials');
  const missingCreds = await makeRequest('/api/auth/login', 'POST', {});
  console.log(`  Status: ${missingCreds.status}`);
  console.log(`  Response: ${JSON.stringify(missingCreds.data)}\n`);

  // Test 3: Login with invalid credentials
  console.log('Test 3: Login with invalid credentials');
  const invalidCreds = await makeRequest('/api/auth/login', 'POST', {
    email: 'invalid@example.com',
    password: 'wrongpassword'
  });
  console.log(`  Status: ${invalidCreds.status}`);
  console.log(`  Response: ${JSON.stringify(invalidCreds.data)}\n`);

  // Test 4: Login with valid format but non-existent user
  console.log('Test 4: Login with valid format');
  const validFormat = await makeRequest('/api/auth/login', 'POST', {
    email: 'test@example.com',
    password: 'password123'
  });
  console.log(`  Status: ${validFormat.status}`);
  console.log(`  Response: ${JSON.stringify(validFormat.data)}\n`);

  // Test 5: Auth debug endpoint
  console.log('Test 5: Auth Debug Endpoint');
  const debug = await makeRequest('/api/auth/debug');
  console.log(`  Status: ${debug.status}`);
  console.log(`  Response: ${JSON.stringify(debug.data)}\n`);

  // Test 6: Legacy login endpoint
  console.log('Test 6: Legacy Login Endpoint (/api/login)');
  const legacyLogin = await makeRequest('/api/login', 'POST', {
    email: 'test@example.com',
    password: 'password123'
  });
  console.log(`  Status: ${legacyLogin.status}`);
  console.log(`  Response: ${JSON.stringify(legacyLogin.data)}\n`);

  console.log('✅ Login API Tests Complete');
}

runTests().catch(console.error);
