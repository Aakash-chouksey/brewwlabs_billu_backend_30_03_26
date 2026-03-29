/**
 * Authentication Test Module
 * Validates login and token generation
 */

const { TEST_CONFIG, TEST_STATE } = require('./config');
const { TestUtils, TestLogger } = require('./utils');

class AuthTest {
  constructor() {
    this.credentials = TEST_STATE.credentials;
  }
  
  async run() {
    TestLogger.section('AUTHENTICATION TEST');
    const startTime = Date.now();
    
    try {
      // Step 1: Login with created credentials
      TestLogger.step(1, 'Testing login with created credentials');
      const loginResult = await this.login();
      
      if (!loginResult.success) {
        return TestUtils.recordResult(
          'Login API',
          'FAIL',
          'Login failed',
          loginResult,
          Date.now() - startTime
        );
      }
      
      TestUtils.recordResult(
        'Login API',
        'PASS',
        'Login successful'
      );
      
      // Step 2: Validate response structure
      TestLogger.step(2, 'Validating login response structure');
      const contractValidation = TestUtils.validateResponseContract(
        loginResult.data,
        '/api/auth/login'
      );
      
      if (!contractValidation.valid) {
        return TestUtils.recordResult(
          'Login Response Contract',
          'FAIL',
          'Response contract validation failed',
          { issues: contractValidation.issues },
          Date.now() - startTime
        );
      }
      
      TestUtils.recordResult(
        'Login Response Contract',
        'PASS',
        'Response structure is valid'
      );
      
      // Step 3: Validate token presence
      TestLogger.step(3, 'Validating authentication tokens');
      const tokenValidation = this.validateTokens(loginResult.data);
      
      if (!tokenValidation.valid) {
        return TestUtils.recordResult(
          'Token Validation',
          'FAIL',
          'Token validation failed',
          { issues: tokenValidation.issues },
          Date.now() - startTime
        );
      }
      
      // Store tokens
      TEST_STATE.authToken = loginResult.data.data?.token || loginResult.data.token;
      TEST_STATE.refreshToken = loginResult.data.data?.refreshToken || loginResult.data.refreshToken;
      
      TestUtils.recordResult(
        'Token Validation',
        'PASS',
        'Both access and refresh tokens present'
      );
      
      // Step 4: Validate token format (JWT)
      TestLogger.step(4, 'Validating JWT token format');
      const jwtValidation = this.validateJWTFormat(TEST_STATE.authToken);
      
      if (!jwtValidation.valid) {
        return TestUtils.recordResult(
          'JWT Format',
          'FAIL',
          'Invalid JWT token format',
          { issues: jwtValidation.issues },
          Date.now() - startTime
        );
      }
      
      TestUtils.recordResult(
        'JWT Format',
        'PASS',
        'Token is valid JWT format'
      );
      
      // Step 5: Test protected API access
      TestLogger.step(5, 'Testing protected API access');
      const protectedAccess = await this.testProtectedAccess();
      
      if (!protectedAccess.success) {
        return TestUtils.recordResult(
          'Protected API Access',
          'FAIL',
          'Cannot access protected endpoints',
          protectedAccess,
          Date.now() - startTime
        );
      }
      
      TestUtils.recordResult(
        'Protected API Access',
        'PASS',
        'Token works for protected endpoints'
      );
      
      // Step 6: Test invalid credentials
      TestLogger.step(6, 'Testing invalid credentials rejection');
      const invalidLogin = await this.testInvalidCredentials();
      
      if (!invalidLogin.success) {
        TestUtils.recordResult(
          'Invalid Credentials Test',
          'PASS',
          'Invalid credentials correctly rejected'
        );
      } else {
        TestUtils.recordResult(
          'Invalid Credentials Test',
          'WARNING',
          'Invalid credentials were accepted (security issue)'
        );
      }
      
      return {
        success: true,
        token: TEST_STATE.authToken,
        refreshToken: TEST_STATE.refreshToken,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      return TestUtils.recordResult(
        'Authentication Test',
        'FAIL',
        `Unexpected error: ${error.message}`,
        { stack: error.stack },
        Date.now() - startTime
      );
    }
  }
  
  async login() {
    const payload = {
      email: this.credentials.businessEmail,
      password: this.credentials.password
    };
    
    return await TestUtils.makeRequest(
      'POST',
      '/api/auth/login',
      payload,
      {},
      TEST_CONFIG.timeouts.login
    );
  }
  
  validateTokens(data) {
    const issues = [];
    const responseData = data.data || data;
    
    // Check for token (could be 'token' or 'accessToken')
    const token = responseData.token || responseData.accessToken;
    if (!token) {
      issues.push('Missing access token in response');
    }
    
    // Check for refresh token
    if (!responseData.refreshToken) {
      issues.push('Missing refresh token in response');
    }
    
    // Check for user data
    if (!responseData.user) {
      issues.push('Missing user data in response');
    } else {
      const user = responseData.user;
      if (!user.id) issues.push('Missing user.id');
      if (!user.email) issues.push('Missing user.email');
      if (!user.role) issues.push('Missing user.role');
    }
    
    return {
      valid: issues.length === 0,
      issues,
      token,
      refreshToken: responseData.refreshToken
    };
  }
  
  validateJWTFormat(token) {
    const issues = [];
    
    if (!token) {
      issues.push('Token is empty');
      return { valid: false, issues };
    }
    
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      issues.push(`Invalid JWT structure: expected 3 parts, got ${parts.length}`);
    }
    
    // Check if parts are base64 encoded
    try {
      if (parts[0]) {
        const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
        if (!header.alg) issues.push('Missing algorithm in JWT header');
      }
    } catch (e) {
      issues.push('Invalid JWT header encoding');
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
  
  async testProtectedAccess() {
    // Try to access a protected endpoint
    const result = await TestUtils.makeRequest(
      'GET',
      '/api/tenant/dashboard',
      null,
      {
        'Authorization': `Bearer ${TEST_STATE.authToken}`
      },
      TEST_CONFIG.timeouts.api
    );
    
    return {
      success: result.status === 200 || result.status === 404, // 404 is OK if no data yet
      status: result.status,
      error: result.error
    };
  }
  
  async testInvalidCredentials() {
    const payload = {
      email: this.credentials.businessEmail,
      password: 'WrongPassword123!'
    };
    
    return await TestUtils.makeRequest(
      'POST',
      '/api/auth/login',
      payload,
      {},
      TEST_CONFIG.timeouts.login
    );
  }
}

module.exports = AuthTest;
