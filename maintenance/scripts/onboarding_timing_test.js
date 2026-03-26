/**
 * Comprehensive Onboarding API Timing Test
 * Tests exact response times for onboarding flow
 */

const http = require('http');
const https = require('https');

const API_BASE = process.env.API_URL || 'http://localhost:3000';

// Test data
const testUser = {
  email: `user_${Date.now()}@test.com`,
  password: 'TestPass123!',
  firstName: 'John',
  lastName: 'Doe',
  businessName: 'Test Business ' + Date.now(),
  businessType: 'Retail',
  phoneNumber: '+1234567890'
};

// Utility: Make HTTP request with timing
async function makeRequest(method, endpoint, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + endpoint);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    }

    const startTime = process.hrtime.bigint();

    const req = client.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to ms

        try {
          const parsed = JSON.parse(responseData);
          resolve({
            status: res.statusCode,
            duration: duration,
            data: parsed,
            headers: res.headers
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            duration: duration,
            data: responseData,
            headers: res.headers
          });
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

// Test phases
async function runTimingTest() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║       ONBOARDING API - COMPREHENSIVE TIMING TEST          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`API Base: ${API_BASE}`);
  console.log(`Test User Email: ${testUser.email}\n`);

  const results = {
    phase1: null,
    phase2: null,
    phase3: null,
    total: 0,
    startTime: Date.now()
  };

  let authToken = null;

  try {
    // ============================================================
    // PHASE 1: User Registration & Authentication
    // ============================================================
    console.log('🔵 PHASE 1: User Registration & Authentication');
    console.log('─'.repeat(60));

    const registerPayload = {
      email: testUser.email,
      password: testUser.password,
      firstName: testUser.firstName,
      lastName: testUser.lastName
    };

    console.log('POST /api/auth/register');
    const registerResponse = await makeRequest('POST', '/api/auth/register', registerPayload);
    results.phase1 = {
      register: {
        duration: registerResponse.duration.toFixed(2),
        status: registerResponse.status,
        timestamp: new Date().toISOString()
      }
    };

    console.log(`  Status: ${registerResponse.status}`);
    console.log(`  Duration: ${registerResponse.duration.toFixed(2)}ms`);

    if (registerResponse.status !== 201 && registerResponse.status !== 200) {
      console.error('  ❌ Registration failed:', registerResponse.data);
      return results;
    }

    // Login
    console.log('\nPOST /api/auth/login');
    const loginPayload = {
      email: testUser.email,
      password: testUser.password
    };

    const loginResponse = await makeRequest('POST', '/api/auth/login', loginPayload);
    results.phase1.login = {
      duration: loginResponse.duration.toFixed(2),
      status: loginResponse.status,
      timestamp: new Date().toISOString()
    };

    console.log(`  Status: ${loginResponse.status}`);
    console.log(`  Duration: ${loginResponse.duration.toFixed(2)}ms`);

    if (loginResponse.status !== 200) {
      console.error('  ❌ Login failed:', loginResponse.data);
      return results;
    }

    // Extract auth token
    authToken = loginResponse.data.token || loginResponse.data.data?.token;
    console.log(`  ✅ Auth Token: ${authToken ? authToken.substring(0, 20) + '...' : 'NOT FOUND'}`);

    const phase1Duration = (
      parseFloat(results.phase1.register.duration) +
      parseFloat(results.phase1.login.duration)
    );
    console.log(`\n  📊 Phase 1 Total: ${phase1Duration.toFixed(2)}ms\n`);

    // ============================================================
    // PHASE 2: Business Setup & Configuration
    // ============================================================
    console.log('🟡 PHASE 2: Business Setup & Configuration');
    console.log('─'.repeat(60));

    const businessPayload = {
      businessName: testUser.businessName,
      businessType: testUser.businessType,
      phoneNumber: testUser.phoneNumber
    };

    console.log('POST /api/onboarding/business-setup');
    const businessResponse = await makeRequest(
      'POST',
      '/api/onboarding/business-setup',
      businessPayload,
      { 'Authorization': `Bearer ${authToken}` }
    );

    results.phase2 = {
      businessSetup: {
        duration: businessResponse.duration.toFixed(2),
        status: businessResponse.status,
        timestamp: new Date().toISOString()
      }
    };

    console.log(`  Status: ${businessResponse.status}`);
    console.log(`  Duration: ${businessResponse.duration.toFixed(2)}ms`);

    if (businessResponse.status !== 201 && businessResponse.status !== 200) {
      console.error('  ⚠️  Business setup returned:', businessResponse.status);
      console.error('  Response:', businessResponse.data);
    } else {
      console.log('  ✅ Business setup complete');
    }

    const businessId = businessResponse.data?.data?.id || businessResponse.data?.id;
    console.log(`  Business ID: ${businessId || 'NOT FOUND'}`);

    console.log(`\n  📊 Phase 2 Total: ${results.phase2.businessSetup.duration}ms\n`);

    // ============================================================
    // PHASE 3: Store/Outlet Setup
    // ============================================================
    console.log('🟢 PHASE 3: Store/Outlet Setup');
    console.log('─'.repeat(60));

    const outletPayload = {
      outletName: 'Main Store',
      outletType: 'Store',
      address: '123 Main St',
      city: 'Test City',
      state: 'TS',
      zipCode: '12345',
      country: 'US'
    };

    console.log('POST /api/onboarding/outlet-setup');
    const outletResponse = await makeRequest(
      'POST',
      '/api/onboarding/outlet-setup',
      outletPayload,
      { 'Authorization': `Bearer ${authToken}` }
    );

    results.phase3 = {
      outletSetup: {
        duration: outletResponse.duration.toFixed(2),
        status: outletResponse.status,
        timestamp: new Date().toISOString()
      }
    };

    console.log(`  Status: ${outletResponse.status}`);
    console.log(`  Duration: ${outletResponse.duration.toFixed(2)}ms`);

    if (outletResponse.status !== 201 && outletResponse.status !== 200) {
      console.error('  ⚠️  Outlet setup returned:', outletResponse.status);
      console.error('  Response:', outletResponse.data);
    } else {
      console.log('  ✅ Outlet setup complete');
    }

    console.log(`\n  📊 Phase 3 Total: ${results.phase3.outletSetup.duration}ms\n`);

    // ============================================================
    // Summary
    // ============================================================
    const totalDuration = Date.now() - results.startTime;
    results.total = totalDuration;

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                     TIMING SUMMARY                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('Phase 1 (Auth)');
    console.log(`  Register: ${results.phase1.register.duration}ms`);
    console.log(`  Login:    ${results.phase1.login.duration}ms`);
    console.log(`  Total:    ${(parseFloat(results.phase1.register.duration) + parseFloat(results.phase1.login.duration)).toFixed(2)}ms\n`);

    console.log('Phase 2 (Business)');
    console.log(`  Setup:    ${results.phase2.businessSetup.duration}ms\n`);

    console.log('Phase 3 (Outlet)');
    console.log(`  Setup:    ${results.phase3.outletSetup.duration}ms\n`);

    console.log('═'.repeat(60));
    console.log(`TOTAL ONBOARDING TIME: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
    console.log('═'.repeat(60));

    // Determine if it meets performance targets
    console.log('\n✨ PERFORMANCE TARGETS:');
    console.log(`  Target: < 3 seconds`);
    console.log(`  Actual: ${(totalDuration / 1000).toFixed(2)} seconds`);

    if (totalDuration < 3000) {
      console.log('  Status: ✅ PASS - Excellent performance');
    } else if (totalDuration < 5000) {
      console.log('  Status: ⚠️  WARN - Acceptable but could be faster');
    } else {
      console.log('  Status: ❌ FAIL - Exceeds acceptable threshold');
    }

    console.log('\n');

  } catch (error) {
    console.error('\n❌ Test Error:', error.message);
  }

  return results;
}

// Run the test
runTimingTest().then(results => {
  console.log('Test Results:', JSON.stringify(results, null, 2));
  process.exit(0);
}).catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
