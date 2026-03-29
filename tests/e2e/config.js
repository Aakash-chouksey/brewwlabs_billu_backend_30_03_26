/**
 * E2E Test Configuration
 * Centralized config for all test modules
 */

require('dotenv').config();

const TEST_CONFIG = {
  // Base URL for API tests
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:8000',
  
  // Test credentials (timestamp-based for uniqueness)
  getTestCredentials: () => {
    const timestamp = Date.now();
    return {
      businessName: `Test Cafe ${timestamp}`,
      businessEmail: `test${timestamp}@example.com`,
      phone: `98765${timestamp.toString().slice(-5)}`,
      address: '123 Test Street, Test City',
      ownerName: 'Test Owner',
      password: 'TestPass123!',
      gstNumber: `GST${timestamp}`
    };
  },
  
  // Timeouts
  timeouts: {
    onboarding: 30000,      // 30s for onboarding
    login: 10000,           // 10s for login
    api: 10000,             // 10s for API calls
    dbQuery: 15000,         // 15s for DB queries
    serverStartup: 60000    // 60s for server startup
  },
  
  // Retry configuration
  retries: {
    onboarding: 3,
    login: 2,
    api: 2
  },
  
  // Required tables in tenant schema
  requiredTenantTables: [
    'outlets', 'products', 'orders', 'categories', 'inventory_items',
    'users', 'customers', 'settings', 'tables', 'areas'
  ],
  
  // Required public schema tables
  requiredPublicTables: [
    'businesses', 'users', 'tenant_registry', 'subscriptions', 'plans'
  ],
  
  // Required tenant_registry columns
  requiredRegistryColumns: [
    'id', 'business_id', 'schema_name', 'status', 
    'retry_count', 'last_error', 'activated_at', 'created_at'
  ],
  
  // API endpoints to test
  apiEndpoints: [
    { path: '/api/tenant/dashboard', method: 'GET', name: 'Dashboard' },
    { path: '/api/tenant/products', method: 'GET', name: 'Products' },
    { path: '/api/tenant/orders', method: 'GET', name: 'Orders' },
    { path: '/api/tenant/categories', method: 'GET', name: 'Categories' },
    { path: '/api/tenant/users', method: 'GET', name: 'Users' },
    { path: '/api/tenant/inventory', method: 'GET', name: 'Inventory' }
  ],
  
  // Database connection (for direct verification)
  getDatabaseUrl: () => process.env.DATABASE_URL || process.env.POSTGRES_URI
};

// Test state (shared across modules)
const TEST_STATE = {
  testId: null,
  credentials: null,
  businessId: null,
  tenantId: null,
  schemaName: null,
  authToken: null,
  refreshToken: null,
  testResults: [],
  startTime: null,
  endTime: null
};

module.exports = { TEST_CONFIG, TEST_STATE };
