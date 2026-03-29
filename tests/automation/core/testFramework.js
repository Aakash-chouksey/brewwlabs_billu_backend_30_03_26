/**
 * PLATFORM-WIDE AUTOMATION TEST SYSTEM
 * ====================================
 * 
 * Comprehensive test suite for multi-tenant POS system that:
 * 1. Resets system to clean state
 * 2. Tests onboarding flow
 * 3. Validates database structure
 * 4. Checks data integrity
 * 5. Tests all APIs
 * 6. Detects and reports issues
 * 7. Auto-fixes code-level issues
 * 
 * @author QA Automation System
 * @version 1.0.0
 */

const axios = require('axios');
const { Sequelize } = require('sequelize');
require('dotenv').config();

// Test Configuration
const CONFIG = {
  API_BASE_URL: process.env.TEST_API_URL || 'http://localhost:8000',
  DB_CONNECTION_STRING: process.env.DATABASE_URL,
  TEST_TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000
};

// Test Results Storage
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0,
  issues: [],
  fixes: [],
  startTime: null,
  endTime: null
};

/**
 * Logger utility with structured output
 */
const logger = {
  info: (msg, data = null) => {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level: 'INFO', message: msg, data };
    console.log(`[${timestamp}] ℹ️  ${msg}`, data ? JSON.stringify(data, null, 2) : '');
    return logEntry;
  },
  
  success: (msg, data = null) => {
    const timestamp = new Date().toISOString();
    testResults.passed++;
    console.log(`[${timestamp}] ✅ ${msg}`, data ? JSON.stringify(data, null, 2) : '');
    return { timestamp, level: 'SUCCESS', message: msg, data };
  },
  
  error: (msg, error = null, data = null) => {
    const timestamp = new Date().toISOString();
    testResults.failed++;
    const issue = {
      timestamp,
      level: 'ERROR',
      message: msg,
      error: error?.message || error,
      stack: error?.stack,
      data
    };
    testResults.issues.push(issue);
    console.error(`[${timestamp}] ❌ ${msg}`, error ? `\nError: ${error.message}` : '', data ? JSON.stringify(data, null, 2) : '');
    return issue;
  },
  
  warning: (msg, data = null) => {
    const timestamp = new Date().toISOString();
    testResults.warnings++;
    console.warn(`[${timestamp}] ⚠️  ${msg}`, data ? JSON.stringify(data, null, 2) : '');
    return { timestamp, level: 'WARNING', message: msg, data };
  },
  
  section: (title) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`  ${title}`);
    console.log(`${'='.repeat(80)}\n`);
  }
};

/**
 * Retry wrapper for async operations
 */
async function withRetry(operation, description, maxRetries = CONFIG.RETRY_ATTEMPTS) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) {
        throw new Error(`${description} failed after ${maxRetries} attempts: ${error.message}`);
      }
      logger.warning(`Attempt ${attempt} failed for ${description}, retrying...`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
    }
  }
}

/**
 * API Client with error handling
 */
const apiClient = axios.create({
  baseURL: CONFIG.API_BASE_URL,
  timeout: CONFIG.TEST_TIMEOUT,
  headers: { 'Content-Type': 'application/json' }
});

// Add response interceptor for logging
apiClient.interceptors.response.use(
  response => response,
  error => {
    const errorData = {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    };
    return Promise.reject(errorData);
  }
);

/**
 * Database connector
 */
let sequelize = null;

async function getDBConnection() {
  if (!sequelize) {
    sequelize = new Sequelize(CONFIG.DB_CONNECTION_STRING, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      }
    });
  }
  return sequelize;
}

/**
 * System Reset Module - Step 1
 */
class SystemResetModule {
  async execute() {
    logger.section('STEP 1: FULL SYSTEM RESET');
    
    const db = await getDBConnection();
    
    try {
      // 1. Drop all tenant schemas
      logger.info('Dropping all tenant schemas...');
      const schemas = await db.query(`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'tenant_%'
      `, { type: Sequelize.QueryTypes.SELECT });
      
      for (const { schema_name } of schemas) {
        try {
          await db.query(`DROP SCHEMA IF EXISTS "${schema_name}" CASCADE`);
          logger.success(`Dropped schema: ${schema_name}`);
        } catch (error) {
          logger.error(`Failed to drop schema ${schema_name}`, error);
        }
      }
      
      // 2. Clear public tables (except critical system tables)
      logger.info('Clearing public tables...');
      const tables = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('sequelize_meta', 'schema_versions')
      `, { type: Sequelize.QueryTypes.SELECT });
      
      for (const { table_name } of tables) {
        try {
          await db.query(`TRUNCATE TABLE "public"."${table_name}" CASCADE`);
          logger.success(`Truncated table: ${table_name}`);
        } catch (error) {
          logger.error(`Failed to truncate ${table_name}`, error);
        }
      }
      
      // 3. Reset sequences
      logger.info('Resetting sequences...');
      const sequences = await db.query(`
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'public'
      `, { type: Sequelize.QueryTypes.SELECT });
      
      for (const { sequence_name } of sequences) {
        try {
          await db.query(`ALTER SEQUENCE "${sequence_name}" RESTART WITH 1`);
        } catch (error) {
          // Non-critical, just log
          logger.warning(`Could not reset sequence ${sequence_name}`);
        }
      }
      
      logger.success('System reset complete - database is clean');
      return { success: true };
      
    } catch (error) {
      logger.error('System reset failed', error);
      throw error;
    }
  }
}

/**
 * Onboarding Validation Module - Step 2
 */
class OnboardingValidationModule {
  constructor() {
    this.testTenant = null;
    this.credentials = {
      businessName: `Test Business ${Date.now()}`,
      businessEmail: `test${Date.now()}@example.com`,
      businessPhone: '+1234567890',
      adminName: 'Test Admin',
      adminEmail: `admin${Date.now()}@example.com`,
      adminPassword: 'TestPass123!',
      cafeType: 'SOLO'
    };
  }
  
  async execute() {
    logger.section('STEP 2: ONBOARDING VALIDATION');
    
    try {
      // 1. Trigger onboarding API
      logger.info('Triggering onboarding API...');
      const response = await withRetry(
        () => apiClient.post('/api/onboarding/business', this.credentials),
        'Onboarding API call'
      );
      
      if (!response.data?.success) {
        throw new Error(`Onboarding failed: ${response.data?.message || 'Unknown error'}`);
      }
      
      this.testTenant = response.data;
      logger.success('Onboarding API call successful', {
        tenantId: this.testTenant.tenantId,
        status: this.testTenant.status
      });
      
      // 2. Wait for background processing
      logger.info('Waiting for background processing (5 seconds)...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 3. Validate business created
      await this.validateBusinessCreated();
      
      // 4. Validate tenant_registry entry
      await this.validateTenantRegistry();
      
      // 5. Validate schema created
      await this.validateSchemaCreated();
      
      // 6. Validate status
      await this.validateStatus();
      
      logger.success('Onboarding validation complete');
      return { success: true, tenant: this.testTenant };
      
    } catch (error) {
      logger.error('Onboarding validation failed', error);
      throw error;
    }
  }
  
  async validateBusinessCreated() {
    const db = await getDBConnection();
    const business = await db.query(
      'SELECT * FROM public.businesses WHERE email = :email',
      { replacements: { email: this.credentials.businessEmail }, type: Sequelize.QueryTypes.SELECT }
    );
    
    if (!business.length) {
      throw new Error('Business was not created in public.businesses table');
    }
    
    this.businessId = business[0].id;
    logger.success('Business created successfully', { businessId: this.businessId });
  }
  
  async validateTenantRegistry() {
    const db = await getDBConnection();
    const registry = await db.query(
      'SELECT * FROM public.tenant_registry WHERE business_id = :businessId',
      { replacements: { businessId: this.businessId }, type: Sequelize.QueryTypes.SELECT }
    );
    
    if (!registry.length) {
      throw new Error('Tenant registry entry not created');
    }
    
    this.registry = registry[0];
    this.schemaName = this.registry.schema_name;
    
    logger.success('Tenant registry entry created', {
      schemaName: this.schemaName,
      status: this.registry.status
    });
  }
  
  async validateSchemaCreated() {
    const db = await getDBConnection();
    const schema = await db.query(
      'SELECT schema_name FROM information_schema.schemata WHERE schema_name = :schema',
      { replacements: { schema: this.schemaName }, type: Sequelize.QueryTypes.SELECT }
    );
    
    if (!schema.length) {
      throw new Error(`Schema ${this.schemaName} was not created`);
    }
    
    logger.success('Tenant schema created', { schemaName: this.schemaName });
  }
  
  async validateStatus() {
    const db = await getDBConnection();
    const registry = await db.query(
      'SELECT status FROM public.tenant_registry WHERE business_id = :businessId',
      { replacements: { businessId: this.businessId }, type: Sequelize.QueryTypes.SELECT }
    );
    
    const status = registry[0]?.status;
    
    if (status === 'INIT_FAILED') {
      throw new Error('Onboarding failed - status is INIT_FAILED');
    }
    
    // Note: Background migration may still be running, so we accept CREATING or active
    if (status !== 'active' && status !== 'CREATING') {
      logger.warning(`Unexpected status: ${status} (expected active or CREATING)`);
    } else {
      logger.success('Tenant status valid', { status });
    }
  }
  
  getTestTenant() {
    return {
      businessId: this.businessId,
      schemaName: this.schemaName,
      credentials: this.credentials,
      registry: this.registry
    };
  }
}

// Export modules for use in main test runner
module.exports = {
  CONFIG,
  logger,
  testResults,
  withRetry,
  apiClient,
  getDBConnection,
  SystemResetModule,
  OnboardingValidationModule
};
