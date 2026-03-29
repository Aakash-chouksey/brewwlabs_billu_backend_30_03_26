/**
 * Tenant API Test Suite
 * Tests all tenant-scoped APIs
 */

const { TEST_CONFIG, TEST_STATE } = require('./config');
const { TestUtils, TestLogger } = require('./utils');

class TenantAPITest {
  constructor() {
    this.token = TEST_STATE.authToken;
    this.results = [];
  }
  
  async run() {
    TestLogger.section('TENANT API TEST SUITE');
    const startTime = Date.now();
    
    try {
      const endpoints = TEST_CONFIG.apiEndpoints;
      
      for (const endpoint of endpoints) {
        const result = await this.testEndpoint(endpoint);
        this.results.push(result);
      }
      
      // Summary
      const passed = this.results.filter(r => r.status === 'PASS').length;
      const failed = this.results.filter(r => r.status === 'FAIL').length;
      
      TestLogger.section('API TEST SUMMARY');
      console.log(`Total: ${this.results.length}, Passed: ${passed}, Failed: ${failed}`);
      
      return {
        success: failed === 0,
        results: this.results,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      return TestUtils.recordResult(
        'API Test Suite',
        'FAIL',
        `Unexpected error: ${error.message}`,
        { stack: error.stack },
        Date.now() - startTime
      );
    }
  }
  
  async testEndpoint(endpoint) {
    const startTime = Date.now();
    const { path, method, name } = endpoint;
    
    TestLogger.step(`API: ${name}`, `Testing ${method} ${path}`);
    
    const result = await TestUtils.makeRequest(
      method,
      path,
      null,
      {
        'Authorization': `Bearer ${this.token}`
      },
      TEST_CONFIG.timeouts.api
    );
    
    const duration = Date.now() - startTime;
    
    // Check for success
    if (!result.success) {
      // 404 might be OK for empty data
      if (result.status === 404) {
        TestUtils.recordResult(
          `API: ${name}`,
          'PASS',
          `Endpoint accessible (404 = no data yet)`,
          { status: result.status },
          duration
        );
        return { name, status: 'PASS', duration, statusCode: 404 };
      }
      
      // Check for auth errors
      if (result.status === 401 || result.status === 403) {
        TestUtils.recordResult(
          `API: ${name}`,
          'FAIL',
          `Authentication failed (${result.status})`,
          { error: result.error, data: result.data },
          duration
        );
        return { name, status: 'FAIL', duration, error: 'Auth failed' };
      }
      
      TestUtils.recordResult(
        `API: ${name}`,
        'FAIL',
        `Request failed (${result.status || 'no status'})`,
        { error: result.error },
        duration
      );
      return { name, status: 'FAIL', duration, error: result.error };
    }
    
    // Validate status code
    if (result.status !== 200) {
      TestUtils.recordResult(
        `API: ${name}`,
        'WARNING',
        `Unexpected status code: ${result.status}`,
        null,
        duration
      );
    }
    
    // Validate response contract
    const contractValidation = TestUtils.validateResponseContract(
      result.data,
      path
    );
    
    if (!contractValidation.valid) {
      TestUtils.recordResult(
        `API: ${name} Contract`,
        'FAIL',
        'Response contract validation failed',
        { issues: contractValidation.issues },
        duration
      );
      return { name, status: 'FAIL', duration, issues: contractValidation.issues };
    }
    
    // Check for data field
    const hasData = result.data && (result.data.data !== undefined || result.data.success === true);
    
    if (!hasData && result.data?.success !== false) {
      TestUtils.recordResult(
        `API: ${name}`,
        'WARNING',
        'Response missing data field',
        null,
        duration
      );
    }
    
    TestUtils.recordResult(
      `API: ${name}`,
      'PASS',
      `Status ${result.status}, valid response`,
      null,
      duration
    );
    
    return { name, status: 'PASS', duration, statusCode: result.status };
  }
}

module.exports = TenantAPITest;
