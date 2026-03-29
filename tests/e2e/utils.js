/**
 * Test Utilities & Helpers
 * Common functions for all test modules
 */

const axios = require('axios');
const { TEST_CONFIG, TEST_STATE } = require('./config');

// ANSI color codes for console output
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

class TestLogger {
  static info(message) {
    console.log(`${COLORS.blue}ℹ️  ${message}${COLORS.reset}`);
  }
  
  static success(message) {
    console.log(`${COLORS.green}✅ ${message}${COLORS.reset}`);
  }
  
  static error(message, details = null) {
    console.log(`${COLORS.red}❌ ${message}${COLORS.reset}`);
    if (details) {
      console.log(`${COLORS.red}   Details: ${JSON.stringify(details, null, 2)}${COLORS.reset}`);
    }
  }
  
  static warning(message) {
    console.log(`${COLORS.yellow}⚠️  ${message}${COLORS.reset}`);
  }
  
  static section(title) {
    console.log(`\n${COLORS.bright}${COLORS.cyan}=== ${title} ===${COLORS.reset}\n`);
  }
  
  static step(number, description) {
    console.log(`${COLORS.bright}Step ${number}:${COLORS.reset} ${description}`);
  }
}

class TestUtils {
  // Make HTTP request with timeout and error handling
  static async makeRequest(method, endpoint, data = null, headers = {}, timeout = 10000) {
    const url = `${TEST_CONFIG.baseUrl}${endpoint}`;
    const config = {
      method,
      url,
      timeout,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.data = data;
    }
    
    try {
      const response = await axios(config);
      return {
        success: true,
        status: response.status,
        data: response.data,
        headers: response.headers
      };
    } catch (error) {
      return {
        success: false,
        status: error.response?.status,
        data: error.response?.data,
        error: error.message,
        code: error.code
      };
    }
  }
  
  // Validate API response contract
  static validateResponseContract(response, endpoint) {
    const issues = [];
    
    if (!response || typeof response !== 'object') {
      issues.push('Response is not an object');
      return { valid: false, issues };
    }
    
    // Check required fields
    if (!('success' in response)) {
      issues.push('Missing "success" field');
    } else if (typeof response.success !== 'boolean') {
      issues.push(`"success" should be boolean, got ${typeof response.success}`);
    }
    
    if (!('message' in response)) {
      issues.push('Missing "message" field');
    } else if (typeof response.message !== 'string') {
      issues.push(`"message" should be string, got ${typeof response.message}`);
    }
    
    if (!('data' in response)) {
      issues.push('Missing "data" field');
    }
    
    // Check for null/undefined values
    const hasNullValues = this.checkNullValues(response);
    if (hasNullValues) {
      issues.push('Response contains unexpected null values');
    }
    
    return {
      valid: issues.length === 0,
      issues,
      endpoint
    };
  }
  
  // Recursively check for null values (excluding the 'data' field which can be null)
  static checkNullValues(obj, path = '') {
    if (obj === null || obj === undefined) {
      // Allow null for 'data' field specifically
      if (path === 'data' || path.endsWith('.data')) {
        return false;
      }
      return true;
    }
    
    if (Array.isArray(obj)) {
      return obj.some((item, index) => this.checkNullValues(item, `${path}[${index}]`));
    }
    
    if (typeof obj === 'object') {
      return Object.entries(obj).some(([key, value]) => 
        this.checkNullValues(value, path ? `${path}.${key}` : key)
      );
    }
    
    return false;
  }
  
  // Wait for specified milliseconds
  static async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Retry an async operation
  static async retry(operation, maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (i < maxRetries - 1) {
          await this.wait(delay * Math.pow(2, i)); // Exponential backoff
        }
      }
    }
    
    throw lastError;
  }
  
  // Generate timestamp-based unique identifier
  static generateTestId() {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Validate UUID format
  static isValidUUID(str) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }
  
  // Format duration in ms to human-readable
  static formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }
  
  // Record test result
  static recordResult(step, status, message, details = null, duration = null) {
    const result = {
      step,
      status, // 'PASS', 'FAIL', 'WARNING'
      message,
      details,
      duration,
      timestamp: new Date().toISOString()
    };
    
    TEST_STATE.testResults.push(result);
    
    // Console output
    if (status === 'PASS') {
      TestLogger.success(message + (duration ? ` (${this.formatDuration(duration)})` : ''));
    } else if (status === 'FAIL') {
      TestLogger.error(message, details);
    } else if (status === 'WARNING') {
      TestLogger.warning(message);
    }
    
    return result;
  }
  
  // Calculate test summary
  static calculateSummary() {
    const results = TEST_STATE.testResults;
    return {
      total: results.length,
      passed: results.filter(r => r.status === 'PASS').length,
      failed: results.filter(r => r.status === 'FAIL').length,
      warnings: results.filter(r => r.status === 'WARNING').length,
      duration: TEST_STATE.endTime - TEST_STATE.startTime
    };
  }
  
  // Print final report
  static printFinalReport() {
    const summary = this.calculateSummary();
    
    TestLogger.section('FINAL TEST REPORT');
    
    console.log(`\n${COLORS.bright}Test Summary:${COLORS.reset}`);
    console.log(`  Total Tests: ${summary.total}`);
    console.log(`  ${COLORS.green}Passed: ${summary.passed}${COLORS.reset}`);
    console.log(`  ${COLORS.red}Failed: ${summary.failed}${COLORS.reset}`);
    console.log(`  ${COLORS.yellow}Warnings: ${summary.warnings}${COLORS.reset}`);
    console.log(`  Duration: ${this.formatDuration(summary.duration)}`);
    
    if (summary.failed > 0) {
      console.log(`\n${COLORS.red}${COLORS.bright}Failed Tests:${COLORS.reset}`);
      TEST_STATE.testResults
        .filter(r => r.status === 'FAIL')
        .forEach(r => {
          console.log(`  ❌ ${r.step}: ${r.message}`);
          if (r.details) {
            console.log(`     Details: ${JSON.stringify(r.details)}`);
          }
        });
    }
    
    console.log('');
    
    return summary.failed === 0;
  }
}

module.exports = { TestUtils, TestLogger, COLORS };
