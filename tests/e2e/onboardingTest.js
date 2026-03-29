/**
 * Onboarding Test Module
 * Validates complete tenant onboarding flow
 */

const { TEST_CONFIG, TEST_STATE } = require('./config');
const { TestUtils, TestLogger } = require('./utils');

class OnboardingTest {
  constructor() {
    this.testId = TestUtils.generateTestId();
    TEST_STATE.testId = this.testId;
    TEST_STATE.credentials = TEST_CONFIG.getTestCredentials();
  }
  
  async run() {
    TestLogger.section('ONBOARDING TEST');
    const startTime = Date.now();
    
    try {
      // Step 1: Call onboarding API
      TestLogger.step(1, 'Calling onboarding API');
      const onboardingResult = await this.callOnboardingAPI();
      
      if (!onboardingResult.success) {
        return TestUtils.recordResult(
          'Onboarding API',
          'FAIL',
          'Onboarding API call failed',
          onboardingResult,
          Date.now() - startTime
        );
      }
      
      TestUtils.recordResult(
        'Onboarding API',
        'PASS',
        'Onboarding API returned success',
        { tenantId: onboardingResult.data?.tenantId },
        Date.now() - startTime
      );
      
      // Store tenant info
      TEST_STATE.businessId = onboardingResult.data?.tenantId;
      TEST_STATE.tenantId = onboardingResult.data?.tenantId;
      TEST_STATE.schemaName = `tenant_${TEST_STATE.businessId}`;
      
      // Step 2: Validate response structure
      TestLogger.step(2, 'Validating onboarding response structure');
      const contractValidation = TestUtils.validateResponseContract(
        onboardingResult.data,
        '/api/onboarding/business'
      );
      
      if (!contractValidation.valid) {
        return TestUtils.recordResult(
          'Onboarding Response Contract',
          'FAIL',
          'Response contract validation failed',
          { issues: contractValidation.issues },
          Date.now() - startTime
        );
      }
      
      TestUtils.recordResult(
        'Onboarding Response Contract',
        'PASS',
        'Response structure is valid'
      );
      
      // Step 3: Validate required fields
      TestLogger.step(3, 'Validating required response fields');
      const fieldValidation = this.validateOnboardingFields(onboardingResult.data);
      
      if (!fieldValidation.valid) {
        return TestUtils.recordResult(
          'Onboarding Fields',
          'FAIL',
          'Required fields missing or invalid',
          { issues: fieldValidation.issues },
          Date.now() - startTime
        );
      }
      
      TestUtils.recordResult(
        'Onboarding Fields',
        'PASS',
        'All required fields present and valid'
      );
      
      // Step 4: Wait and check tenant registry status
      TestLogger.step(4, 'Waiting for onboarding completion');
      await TestUtils.wait(5000); // Wait 5s for background processing
      
      const statusCheck = await this.checkTenantStatus();
      
      if (!statusCheck.success) {
        return TestUtils.recordResult(
          'Tenant Status',
          'FAIL',
          'Failed to verify tenant status',
          statusCheck,
          Date.now() - startTime
        );
      }
      
      // Check if status is active or still in progress
      if (statusCheck.status === 'active') {
        TestUtils.recordResult(
          'Tenant Status',
          'PASS',
          'Tenant onboarding completed - status is ACTIVE'
        );
      } else if (statusCheck.status === 'CREATING' || statusCheck.status === 'INIT_IN_PROGRESS') {
        TestUtils.recordResult(
          'Tenant Status',
          'WARNING',
          `Tenant still initializing (status: ${statusCheck.status})`,
          { status: statusCheck.status }
        );
      } else if (statusCheck.status === 'INIT_FAILED') {
        return TestUtils.recordResult(
          'Tenant Status',
          'FAIL',
          'Tenant onboarding FAILED',
          { status: statusCheck.status, error: statusCheck.lastError },
          Date.now() - startTime
        );
      }
      
      return {
        success: true,
        businessId: TEST_STATE.businessId,
        schemaName: TEST_STATE.schemaName,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      return TestUtils.recordResult(
        'Onboarding Test',
        'FAIL',
        `Unexpected error: ${error.message}`,
        { stack: error.stack },
        Date.now() - startTime
      );
    }
  }
  
  async callOnboardingAPI() {
    const credentials = TEST_STATE.credentials;
    
    const payload = {
      name: credentials.businessName,
      email: credentials.businessEmail,
      phone: credentials.phone,
      address: credentials.address,
      owner_name: credentials.ownerName,
      password: credentials.password,
      gst_number: credentials.gstNumber,
      cafeType: 'SOLO'
    };
    
    const result = await TestUtils.makeRequest(
      'POST',
      '/api/onboarding/business',
      payload,
      {},
      TEST_CONFIG.timeouts.onboarding
    );
    
    return result;
  }
  
  validateOnboardingFields(data) {
    const issues = [];
    
    // Check tenantId exists
    if (!data.tenantId) {
      issues.push('Missing tenantId in response');
    } else if (!TestUtils.isValidUUID(data.tenantId)) {
      issues.push(`Invalid tenantId format: ${data.tenantId}`);
    }
    
    // Check status
    if (!data.status) {
      issues.push('Missing status in response');
    } else if (!['CREATING', 'PENDING', 'INIT_IN_PROGRESS', 'active'].includes(data.status)) {
      issues.push(`Unexpected status value: ${data.status}`);
    }
    
    // Check message
    if (!data.message) {
      issues.push('Missing message in response');
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
  
  async checkTenantStatus() {
    try {
      // Query the database directly for tenant status
      const { sequelize } = require('../../config/unified_database');
      
      const [rows] = await sequelize.query(
        `SELECT status, last_error, retry_count, schema_name 
         FROM public.tenant_registry 
         WHERE business_id = ?`,
        { replacements: [TEST_STATE.businessId] }
      );
      
      if (rows.length === 0) {
        return {
          success: false,
          error: 'Tenant registry entry not found'
        };
      }
      
      return {
        success: true,
        status: rows[0].status,
        lastError: rows[0].last_error,
        retryCount: rows[0].retry_count,
        schemaName: rows[0].schema_name
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = OnboardingTest;
