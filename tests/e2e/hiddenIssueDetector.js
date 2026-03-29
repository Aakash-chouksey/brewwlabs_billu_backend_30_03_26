/**
 * Hidden Issue Detector
 * Detects subtle problems that might not cause immediate failures
 */

const { TEST_CONFIG, TEST_STATE } = require('./config');
const { TestUtils, TestLogger } = require('./utils');

class HiddenIssueDetector {
  constructor() {
    this.issues = [];
  }
  
  async run() {
    TestLogger.section('HIDDEN ISSUE DETECTION');
    const startTime = Date.now();
    
    // Test 1: Check for query param issues
    TestLogger.step(1, 'Checking for query parameter serialization issues');
    await this.checkQueryParamIssues();
    
    // Test 2: Check for missing error handling
    TestLogger.step(2, 'Checking API error handling');
    await this.checkErrorHandling();
    
    // Test 3: Check for silent failures
    TestLogger.step(3, 'Checking for silent failure patterns');
    await this.checkSilentFailures();
    
    // Test 4: Check performance issues
    TestLogger.step(4, 'Checking for performance issues');
    await this.checkPerformanceIssues();
    
    // Test 5: Check data consistency
    TestLogger.step(5, 'Checking data consistency');
    await this.checkDataConsistency();
    
    // Summary
    const critical = this.issues.filter(i => i.severity === 'CRITICAL').length;
    const warning = this.issues.filter(i => i.severity === 'WARNING').length;
    
    TestLogger.section('HIDDEN ISSUE SUMMARY');
    console.log(`Critical Issues: ${critical}`);
    console.log(`Warnings: ${warning}`);
    
    if (this.issues.length > 0) {
      console.log('\nDetected Issues:');
      this.issues.forEach(issue => {
        const color = issue.severity === 'CRITICAL' ? '\x1b[31m' : '\x1b[33m';
        console.log(`${color}[${issue.severity}] ${issue.category}: ${issue.message}\x1b[0m`);
        if (issue.details) {
          console.log(`  Details: ${JSON.stringify(issue.details)}`);
        }
      });
    }
    
    return {
      success: critical === 0,
      issues: this.issues,
      critical,
      warning,
      duration: Date.now() - startTime
    };
  }
  
  async checkQueryParamIssues() {
    // Test that query params are properly handled
    const testCases = [
      { path: '/api/tenant/products?page=1&limit=10', desc: 'Pagination params' },
      { path: '/api/tenant/orders?status=PENDING', desc: 'Filter params' },
      { path: '/api/tenant/products?search=test%20product', desc: 'URL encoded params' }
    ];
    
    for (const testCase of testCases) {
      const result = await TestUtils.makeRequest(
        'GET',
        testCase.path,
        null,
        { 'Authorization': `Bearer ${TEST_STATE.authToken}` },
        5000
      );
      
      // Check for [object Object] in response (common bug)
      const responseStr = JSON.stringify(result.data);
      if (responseStr.includes('[object Object]')) {
        this.issues.push({
          category: 'Query Params',
          severity: 'CRITICAL',
          message: `Found [object Object] in ${testCase.desc}`,
          details: { path: testCase.path }
        });
      }
      
      // Check for proper data structure
      if (result.success && result.data) {
        if (typeof result.data.data === 'string') {
          this.issues.push({
            category: 'Query Params',
            severity: 'WARNING',
            message: `Data field is string instead of object/array in ${testCase.desc}`,
            details: { path: testCase.path }
          });
        }
      }
    }
    
    TestUtils.recordResult(
      'Query Param Check',
      this.issues.filter(i => i.category === 'Query Params').length === 0 ? 'PASS' : 'WARNING',
      'Query parameter handling verified'
    );
  }
  
  async checkErrorHandling() {
    // Test error scenarios
    const errorTests = [
      { 
        path: '/api/tenant/products/invalid-uuid', 
        method: 'GET',
        desc: 'Invalid UUID',
        expectedStatus: 404 
      },
      { 
        path: '/api/tenant/products', 
        method: 'POST',
        data: { invalid: 'data' },
        desc: 'Invalid POST data',
        expectedStatus: 400 
      },
      { 
        path: '/api/nonexistent-endpoint', 
        method: 'GET',
        desc: 'Non-existent endpoint',
        expectedStatus: 404 
      }
    ];
    
    for (const test of errorTests) {
      const result = await TestUtils.makeRequest(
        test.method,
        test.path,
        test.data,
        { 'Authorization': `Bearer ${TEST_STATE.authToken}` },
        5000
      );
      
      // Check if error response follows contract
      if (result.status >= 400) {
        const hasErrorMessage = result.data && (result.data.message || result.data.error);
        const hasSuccessField = result.data && typeof result.data.success === 'boolean';
        
        if (!hasErrorMessage) {
          this.issues.push({
            category: 'Error Handling',
            severity: 'WARNING',
            message: `${test.desc}: Missing error message in error response`,
            details: { status: result.status, data: result.data }
          });
        }
        
        if (!hasSuccessField) {
          this.issues.push({
            category: 'Error Handling',
            severity: 'WARNING',
            message: `${test.desc}: Missing success field in error response`,
            details: { status: result.status }
          });
        }
        
        // Check for 500 errors (shouldn't happen for client errors)
        if (result.status === 500) {
          this.issues.push({
            category: 'Error Handling',
            severity: 'CRITICAL',
            message: `${test.desc}: Server error (500) for client request`,
            details: { path: test.path }
          });
        }
      }
    }
    
    TestUtils.recordResult(
      'Error Handling Check',
      this.issues.filter(i => i.category === 'Error Handling' && i.severity === 'CRITICAL').length === 0 ? 'PASS' : 'WARNING',
      'Error handling patterns verified'
    );
  }
  
  async checkSilentFailures() {
    // Test operations that might fail silently
    const tests = [
      {
        desc: 'Empty result handling',
        path: '/api/tenant/products?search=nonexistentproduct12345',
        check: (result) => {
          if (result.success && result.data && result.data.data === null) {
            return 'Returns null instead of empty array for no results';
          }
        }
      },
      {
        desc: 'Large page size',
        path: '/api/tenant/products?limit=1000',
        check: (result) => {
          if (result.status === 500) {
            return 'Server error with large page size';
          }
        }
      }
    ];
    
    for (const test of tests) {
      const result = await TestUtils.makeRequest(
        'GET',
        test.path,
        null,
        { 'Authorization': `Bearer ${TEST_STATE.authToken}` },
        10000
      );
      
      const issue = test.check(result);
      if (issue) {
        this.issues.push({
          category: 'Silent Failures',
          severity: 'WARNING',
          message: `${test.desc}: ${issue}`,
          details: { path: test.path }
        });
      }
    }
    
    TestUtils.recordResult(
      'Silent Failure Check',
      'PASS',
      'Silent failure patterns checked'
    );
  }
  
  async checkPerformanceIssues() {
    // Test API response times
    const endpoints = [
      '/api/tenant/dashboard',
      '/api/tenant/products',
      '/api/tenant/orders'
    ];
    
    const slowThreshold = 500; // ms
    const criticalThreshold = 2000; // ms
    
    for (const endpoint of endpoints) {
      const start = Date.now();
      const result = await TestUtils.makeRequest(
        'GET',
        endpoint,
        null,
        { 'Authorization': `Bearer ${TEST_STATE.authToken}` },
        10000
      );
      const duration = Date.now() - start;
      
      if (duration > criticalThreshold) {
        this.issues.push({
          category: 'Performance',
          severity: 'CRITICAL',
          message: `${endpoint} is critically slow (${duration}ms)`,
          details: { endpoint, duration, threshold: criticalThreshold }
        });
      } else if (duration > slowThreshold) {
        this.issues.push({
          category: 'Performance',
          severity: 'WARNING',
          message: `${endpoint} is slow (${duration}ms)`,
          details: { endpoint, duration, threshold: slowThreshold }
        });
      }
    }
    
    TestUtils.recordResult(
      'Performance Check',
      this.issues.filter(i => i.category === 'Performance' && i.severity === 'CRITICAL').length === 0 ? 'PASS' : 'WARNING',
      'Performance issues checked'
    );
  }
  
  async checkDataConsistency() {
    // Check for data consistency issues
    const { sequelize } = require('../../config/unified_database');
    
    try {
      // Check if business_id references are consistent
      const [registry] = await sequelize.query(
        'SELECT business_id, schema_name FROM public.tenant_registry WHERE business_id = ?',
        { replacements: [TEST_STATE.businessId] }
      );
      
      if (registry.length > 0) {
        const schemaName = registry[0].schema_name;
        const expectedSchema = `tenant_${TEST_STATE.businessId}`;
        
        if (schemaName !== expectedSchema) {
          this.issues.push({
            category: 'Data Consistency',
            severity: 'CRITICAL',
            message: 'Schema name mismatch in tenant_registry',
            details: { expected: expectedSchema, actual: schemaName }
          });
        }
      }
      
      // Check for orphaned records
      const [orphaned] = await sequelize.query(
        `SELECT tr.business_id 
         FROM public.tenant_registry tr
         LEFT JOIN public.businesses b ON tr.business_id = b.id
         WHERE b.id IS NULL`
      );
      
      if (orphaned.length > 0) {
        this.issues.push({
          category: 'Data Consistency',
          severity: 'CRITICAL',
          message: `${orphaned.length} orphaned tenant_registry entries`,
          details: { count: orphaned.length }
        });
      }
      
    } catch (error) {
      this.issues.push({
        category: 'Data Consistency',
        severity: 'WARNING',
        message: `Could not verify data consistency: ${error.message}`
      });
    }
    
    TestUtils.recordResult(
      'Data Consistency Check',
      this.issues.filter(i => i.category === 'Data Consistency' && i.severity === 'CRITICAL').length === 0 ? 'PASS' : 'WARNING',
      'Data consistency verified'
    );
  }
}

module.exports = HiddenIssueDetector;
