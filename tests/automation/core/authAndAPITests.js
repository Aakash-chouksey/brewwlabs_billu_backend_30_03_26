/**
 * AUTHENTICATION & API TEST MODULE
 * ================================
 * 
 * Steps 6-7: Auth Validation and Full API Test Suite
 */

const { logger, withRetry, apiClient, getDBConnection } = require('./testFramework');
const { Sequelize } = require('sequelize');

/**
 * Authentication Validation Module - Step 6
 */
class AuthValidationModule {
  constructor(testTenant) {
    this.testTenant = testTenant;
    this.authToken = null;
    this.refreshToken = null;
  }
  
  async execute() {
    logger.section('STEP 6: AUTH + TOKEN VALIDATION');
    
    try {
      // 1. Test login with created user
      await this.testLogin();
      
      // 2. Validate token structure
      await this.validateToken();
      
      // 3. Test token usage in middleware
      await this.testAuthenticatedRequest();
      
      // 4. Test token refresh
      await this.testTokenRefresh();
      
      logger.success('Authentication validation complete');
      return { 
        success: true, 
        token: this.authToken,
        credentials: this.testTenant.credentials
      };
      
    } catch (error) {
      logger.error('Authentication validation failed', error);
      throw error;
    }
  }
  
  async testLogin() {
    logger.info('Testing login with created admin user...');
    
    const response = await withRetry(
      () => apiClient.post('/api/auth/login', {
        email: this.testTenant.credentials.adminEmail,
        password: this.testTenant.credentials.adminPassword,
        panelType: 'TENANT'
      }),
      'Login API call'
    );
    
    if (!response.data?.success) {
      throw new Error(`Login failed: ${response.data?.message || 'Unknown error'}`);
    }
    
    const { token, refreshToken, user } = response.data.data || {};
    
    if (!token) {
      throw new Error('Login successful but no token received');
    }
    
    this.authToken = token;
    this.refreshToken = refreshToken;
    this.user = user;
    
    // Update apiClient with auth header
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    logger.success('Login successful', { 
      userId: user?.id,
      role: user?.role,
      hasRefreshToken: !!refreshToken
    });
  }
  
  async validateToken() {
    logger.info('Validating token structure...');
    
    // JWT tokens have 3 parts separated by dots
    const parts = this.authToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format - not a valid JWT');
    }
    
    try {
      // Decode payload (middle part)
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      
      // Check required fields
      const requiredFields = ['userId', 'businessId', 'role', 'panelType'];
      const missingFields = requiredFields.filter(field => !payload[field]);
      
      if (missingFields.length > 0) {
        logger.warning(`Token missing fields: ${missingFields.join(', ')}`);
      }
      
      logger.success('Token structure valid', { 
        userId: payload.userId,
        businessId: payload.businessId,
        role: payload.role
      });
    } catch (error) {
      throw new Error(`Failed to decode token: ${error.message}`);
    }
  }
  
  async testAuthenticatedRequest() {
    logger.info('Testing authenticated request...');
    
    const response = await withRetry(
      () => apiClient.get('/api/tenant/dashboard'),
      'Authenticated dashboard request'
    );
    
    if (response.status === 200) {
      logger.success('Authenticated request successful');
    } else if (response.status === 401) {
      throw new Error('Token rejected - authentication failed');
    } else {
      logger.warning(`Dashboard returned status ${response.status}`);
    }
  }
  
  async testTokenRefresh() {
    if (!this.refreshToken) {
      logger.warning('No refresh token available to test');
      return;
    }
    
    logger.info('Testing token refresh...');
    
    try {
      const response = await apiClient.post('/api/auth/refresh', {
        refreshToken: this.refreshToken
      });
      
      if (response.data?.success && response.data?.data?.token) {
        logger.success('Token refresh successful');
      } else {
        logger.warning('Token refresh may not be working correctly');
      }
    } catch (error) {
      logger.warning('Token refresh test failed', error);
    }
  }
  
  getAuthToken() {
    return this.authToken;
  }
}

/**
 * Full API Test Suite - Step 7
 */
class APITestModule {
  constructor(testTenant, authToken) {
    this.testTenant = testTenant;
    this.authToken = authToken;
    this.apiResults = [];
  }
  
  async execute() {
    logger.section('STEP 7: FULL API TEST SUITE');
    
    // Set auth token for all requests
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${this.authToken}`;
    
    // Test all API endpoints
    await this.testDashboardAPIs();
    await this.testProductAPIs();
    await this.testOrderAPIs();
    await this.testCategoryAPIs();
    await this.testUserAPIs();
    await this.testInventoryAPIs();
    await this.testBusinessAPIs();
    await this.testOutletAPIs();
    await this.testTableAPIs();
    await this.testAreaAPIs();
    await this.testSettingsAPIs();
    
    // Calculate results
    const passed = this.apiResults.filter(r => r.passed).length;
    const failed = this.apiResults.filter(r => !r.passed).length;
    const total = this.apiResults.length;
    
    logger.success(`API Test Suite complete: ${passed}/${total} passed, ${failed} failed`);
    
    return {
      success: failed === 0,
      passed,
      failed,
      total,
      results: this.apiResults
    };
  }
  
  async testEndpoint(name, method, url, data = null, expectedStatus = 200) {
    const startTime = Date.now();
    
    try {
      let response;
      switch (method.toLowerCase()) {
        case 'get':
          response = await apiClient.get(url);
          break;
        case 'post':
          response = await apiClient.post(url, data);
          break;
        case 'put':
          response = await apiClient.put(url, data);
          break;
        case 'delete':
          response = await apiClient.delete(url);
          break;
        default:
          throw new Error(`Unknown method: ${method}`);
      }
      
      const duration = Date.now() - startTime;
      const passed = response.status === expectedStatus;
      
      // Check response structure
      const hasValidStructure = response.data && 
        (typeof response.data.success === 'boolean' || response.data.data !== undefined);
      
      const result = {
        name,
        method,
        url,
        status: response.status,
        duration,
        passed: passed && hasValidStructure,
        hasValidStructure,
        success: response.data?.success,
        error: passed ? null : `Expected ${expectedStatus}, got ${response.status}`
      };
      
      this.apiResults.push(result);
      
      if (result.passed) {
        logger.success(`${name} (${duration}ms)`);
      } else {
        logger.error(`${name} failed`, null, result);
      }
      
      return response;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const result = {
        name,
        method,
        url,
        status: error.status || 0,
        duration,
        passed: false,
        hasValidStructure: false,
        success: false,
        error: error.message || 'Request failed'
      };
      
      this.apiResults.push(result);
      logger.error(`${name} failed: ${error.message}`, null, { status: error.status, data: error.data });
      return null;
    }
  }
  
  // Dashboard APIs
  async testDashboardAPIs() {
    logger.info('Testing Dashboard APIs...');
    
    await this.testEndpoint('Dashboard Stats', 'GET', '/api/tenant/dashboard');
    await this.testEndpoint('Analytics Summary', 'GET', '/api/tenant/analytics/summary');
    await this.testEndpoint('Control Center Stats', 'GET', '/api/tenant/control-center');
    await this.testEndpoint('System Health', 'GET', '/api/tenant/system-health');
  }
  
  // Product APIs
  async testProductAPIs() {
    logger.info('Testing Product APIs...');
    
    await this.testEndpoint('Get Products', 'GET', '/api/tenant/products');
    await this.testEndpoint('Get Product Types', 'GET', '/api/tenant/product-types');
  }
  
  // Order APIs
  async testOrderAPIs() {
    logger.info('Testing Order APIs...');
    
    await this.testEndpoint('Get Orders', 'GET', '/api/tenant/orders');
    await this.testEndpoint('Get Live Orders', 'GET', '/api/tenant/live-orders');
    await this.testEndpoint('Get Live Stats', 'GET', '/api/tenant/live-stats');
  }
  
  // Category APIs
  async testCategoryAPIs() {
    logger.info('Testing Category APIs...');
    
    await this.testEndpoint('Get Categories', 'GET', '/api/tenant/categories');
  }
  
  // User/Staff APIs
  async testUserAPIs() {
    logger.info('Testing User APIs...');
    
    await this.testEndpoint('Get Users', 'GET', '/api/tenant/users');
    await this.testEndpoint('Get Profile', 'GET', '/api/tenant/profile');
  }
  
  // Inventory APIs
  async testInventoryAPIs() {
    logger.info('Testing Inventory APIs...');
    
    await this.testEndpoint('Get Inventory Items', 'GET', '/api/inventory/items');
    await this.testEndpoint('Get Inventory Categories', 'GET', '/api/tenant/inventory-categories');
    await this.testEndpoint('Get Inventory Dashboard', 'GET', '/api/tenant/inventory/dashboard');
    await this.testEndpoint('Get Suppliers', 'GET', '/api/inventory/suppliers');
    await this.testEndpoint('Get Low Stock', 'GET', '/api/inventory/low-stock');
  }
  
  // Business APIs
  async testBusinessAPIs() {
    logger.info('Testing Business APIs...');
    
    await this.testEndpoint('Get Business Info', 'GET', '/api/tenant/business');
  }
  
  // Outlet APIs
  async testOutletAPIs() {
    logger.info('Testing Outlet APIs...');
    
    await this.testEndpoint('Get Outlets', 'GET', '/api/tenant/outlets');
  }
  
  // Table APIs
  async testTableAPIs() {
    logger.info('Testing Table APIs...');
    
    await this.testEndpoint('Get Tables', 'GET', '/api/tenant/tables');
    await this.testEndpoint('Get Tables Management', 'GET', '/api/tenant/tables-management');
  }
  
  // Area APIs
  async testAreaAPIs() {
    logger.info('Testing Area APIs...');
    
    await this.testEndpoint('Get Areas', 'GET', '/api/tenant/areas');
  }
  
  // Settings APIs
  async testSettingsAPIs() {
    logger.info('Testing Settings APIs...');
    
    await this.testEndpoint('Get Billing Config', 'GET', '/api/tenant/billing/config');
    await this.testEndpoint('Get Operation Timings', 'GET', '/api/tenant/operation-timings');
  }
}

module.exports = {
  AuthValidationModule,
  APITestModule
};
