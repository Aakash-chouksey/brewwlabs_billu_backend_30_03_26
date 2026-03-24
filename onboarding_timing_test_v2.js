/**
 * Comprehensive Onboarding API Timing Test (V2)
 * Tests exact response times for onboarding flow
 */

const http = require('http');

const API_BASE = process.env.API_URL || 'http://localhost:8000';

// Test data
const timestamp = Date.now();
const testUser = {
  email: `user_${timestamp}@test.com`,
  password: 'TestPass123!',
  firstName: 'John',
  lastName: 'Doe',
  businessName: 'Test Business ' + timestamp,
  businessType: 'Retail',
  phoneNumber: '+1234567890'
};

// Utility: Make HTTP request with timing
async function makeRequest(method, endpoint, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + endpoint);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? require('https') : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
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
    businessOnboarding: null,
    totalDuration: 0,
    startTime: Date.now()
  };

  let businessId = null;

  try {
    // ============================================================
    // MAIN ONBOARDING: Business Registration
    // ============================================================
    console.log('🔵 PHASE 1: Business Onboarding (Registration)');
    console.log('─'.repeat(60));

    const onboardingPayload = {
      email: testUser.email,
      password: testUser.password,
      firstName: testUser.firstName,
      lastName: testUser.lastName,
      businessName: testUser.businessName,
      businessType: testUser.businessType,
      phoneNumber: testUser.phoneNumber
    };

    console.log('POST /api/onboarding/business');
    console.log('Payload: ', onboardingPayload);
    
    const onboardingResponse = await makeRequest(
      'POST',
      '/api/onboarding/business',
      onboardingPayload
    );

    results.businessOnboarding = {
      duration: onboardingResponse.duration.toFixed(2),
      status: onboardingResponse.status,
      timestamp: new Date().toISOString()
    };

    console.log(`\n  Status: ${onboardingResponse.status}`);
    console.log(`  Duration: ${onboardingResponse.duration.toFixed(2)}ms`);
    console.log(`  Response: ${JSON.stringify(onboardingResponse.data).substring(0, 200)}...`);

    if (onboardingResponse.status !== 201 && onboardingResponse.status !== 200) {
      console.error('\n  ❌ Onboarding failed');
      console.error('  Full Response:', JSON.stringify(onboardingResponse.data, null, 2));
    } else {
      console.log('  ✅ Business onboarding complete');
      businessId = onboardingResponse.data?.data?.business?.id || 
                    onboardingResponse.data?.business?.id ||
                    onboardingResponse.data?.id;
      console.log(`  Business ID: ${businessId}`);
    }

    // ============================================================
    // Summary
    // ============================================================
    const totalDuration = Date.now() - results.startTime;
    results.totalDuration = totalDuration;

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                     TIMING SUMMARY                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('Business Onboarding:');
    console.log(`  Duration: ${results.businessOnboarding.duration}ms`);
    console.log(`  Status Code: ${results.businessOnboarding.status}\n`);

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

    // Detailed breakdown
    console.log('\n📊 DETAILED BREAKDOWN:');
    console.log(`  API Response Time: ${results.businessOnboarding.duration}ms`);
    console.log(`  Network/System Overhead: ${(totalDuration - parseFloat(results.businessOnboarding.duration)).toFixed(2)}ms`);
    console.log(`  Total: ${totalDuration}ms\n`);

  } catch (error) {
    console.error('\n❌ Test Error:', error.message);
    console.error(error);
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
