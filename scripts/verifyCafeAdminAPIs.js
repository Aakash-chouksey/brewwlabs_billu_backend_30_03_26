require('dotenv').config();
const axios = require('axios');
const { sequelize } = require('../config/database_postgres');

// Test configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';
const TEST_JWT_TOKEN = process.env.TEST_JWT_TOKEN || null;

// API endpoints to test
const API_ENDPOINTS = [
  // Auth & Profile
  { method: 'GET', path: '/api/tenant/profile', description: 'Get user profile' },
  { method: 'GET', path: '/api/tenant/users', description: 'Get all users' },
  
  // Categories
  { method: 'GET', path: '/api/tenant/categories', description: 'Get all categories' },
  
  // Products
  { method: 'GET', path: '/api/tenant/products', description: 'Get all products' },
  
  // Product Types
  { method: 'GET', path: '/api/tenant/product-types', description: 'Get all product types' },
  
  // Tables
  { method: 'GET', path: '/api/tenant/tables', description: 'Get all tables' },
  { method: 'GET', path: '/api/tenant/tables-management', description: 'Get tables management' },
  
  // Areas
  { method: 'GET', path: '/api/tenant/areas', description: 'Get all areas' },
  
  // Orders
  { method: 'GET', path: '/api/tenant/orders', description: 'Get all orders' },
  
  // Accounting
  { method: 'GET', path: '/api/tenant/accounting/accounts', description: 'Get all accounts' },
  { method: 'GET', path: '/api/tenant/accounting/transactions', description: 'Get all transactions' },
  
  // Dashboard
  { method: 'GET', path: '/api/tenant/dashboard', description: 'Get dashboard stats' },
  
  // Outlets
  { method: 'GET', path: '/api/tenant/outlets', description: 'Get all outlets' },
  
  // Inventory
  { method: 'GET', path: '/api/tenant/inventory', description: 'Get inventory' },
  { method: 'GET', path: '/api/tenant/inventory-categories', description: 'Get inventory categories' },
  
  // Expense Types
  { method: 'GET', path: '/api/tenant/expense-types', description: 'Get expense types' },
  
  // Timing
  { method: 'GET', path: '/api/tenant/timing', description: 'Get timing settings' },
  
  // Reports
  { method: 'GET', path: '/api/tenant/reports/sales', description: 'Get sales reports' },
];

async function testAPIEndpoint(endpoint) {
  try {
    const config = {
      method: endpoint.method,
      url: `${BASE_URL}${endpoint.path}`,
      headers: {
        'Content-Type': 'application/json',
        ...(TEST_JWT_TOKEN && { 'Authorization': `Bearer ${TEST_JWT_TOKEN}` })
      },
      timeout: 10000
    };

    console.log(`🔍 Testing ${endpoint.method} ${endpoint.path}...`);
    
    const response = await axios(config);
    
    // Check response structure
    const hasSuccessField = response.data && typeof response.data === 'object' && 'success' in response.data;
    const hasDataField = response.data && response.data.data !== undefined;
    const isArrayData = Array.isArray(response.data?.data);
    const statusCode = response.status;
    
    console.log(`✅ ${endpoint.method} ${endpoint.path}`);
    console.log(`   Status: ${statusCode}`);
    console.log(`   Response structure: ${hasSuccessField ? '✅' : '❌'} success field`);
    console.log(`   Data field: ${hasDataField ? '✅' : '❌'}`);
    console.log(`   Data type: ${isArrayData ? 'Array' : hasDataField ? typeof response.data.data : 'None'}`);
    
    if (isArrayData) {
      console.log(`   Array length: ${response.data.data.length}`);
      if (response.data.data.length > 0) {
        const firstItem = response.data.data[0];
        console.log(`   Sample item keys: ${Object.keys(firstItem).join(', ')}`);
      }
    }
    
    return {
      success: true,
      statusCode,
      hasSuccessField,
      hasDataField,
      isArrayData,
      responseSize: JSON.stringify(response.data).length
    };
    
  } catch (error) {
    console.log(`❌ ${endpoint.method} ${endpoint.path}`);
    console.log(`   Error: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Response: ${JSON.stringify(error.response.data)}`);
    }
    
    return {
      success: false,
      error: error.message,
      statusCode: error.response?.status,
      response: error.response?.data
    };
  }
}

async function testDatabaseConnection() {
  try {
    console.log('🔍 Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    // Test basic queries
    const [outletResult] = await sequelize.query('SELECT COUNT(*) as count FROM outlets');
    const [brandResult] = await sequelize.query('SELECT COUNT(*) as count FROM brands');
    const [categoryResult] = await sequelize.query('SELECT COUNT(*) as count FROM categories');
    const [productResult] = await sequelize.query('SELECT COUNT(*) as count FROM products');
    const [tableResult] = await sequelize.query('SELECT COUNT(*) as count FROM tables');
    
    console.log('📊 Database Statistics:');
    console.log(`   Outlets: ${outletResult[0].count}`);
    console.log(`   Brands: ${brandResult[0].count}`);
    console.log(`   Categories: ${categoryResult[0].count}`);
    console.log(`   Products: ${productResult[0].count}`);
    console.log(`   Tables: ${tableResult[0].count}`);
    
    return true;
  } catch (error) {
    console.log('❌ Database connection failed:', error.message);
    return false;
  }
}

async function generateTestReport(results) {
  console.log('\n📊 API TEST REPORT');
  console.log('==================');
  
  const totalTests = results.length;
  const successfulTests = results.filter(r => r.success).length;
  const failedTests = totalTests - successfulTests;
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Successful: ${successfulTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Success Rate: ${((successfulTests / totalTests) * 100).toFixed(1)}%`);
  
  console.log('\n📋 Detailed Results:');
  results.forEach((result, index) => {
    const endpoint = API_ENDPOINTS[index];
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${endpoint.method} ${endpoint.path} - ${endpoint.description}`);
    if (!result.success) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  // Check response structure consistency
  console.log('\n🔍 Response Structure Analysis:');
  const successResponses = results.filter(r => r.success);
  const withSuccessField = successResponses.filter(r => r.hasSuccessField).length;
  const withDataField = successResponses.filter(r => r.hasDataField).length;
  const withArrayData = successResponses.filter(r => r.isArrayData).length;
  
  console.log(`Endpoints with 'success' field: ${withSuccessField}/${successResponses.length}`);
  console.log(`Endpoints with 'data' field: ${withDataField}/${successResponses.length}`);
  console.log(`Endpoints returning arrays: ${withArrayData}/${successResponses.length}`);
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  if (failedTests > 0) {
    console.log('❌ Some endpoints are failing. Check authentication and server status.');
  }
  if (withSuccessField < successResponses.length) {
    console.log('⚠️  Some endpoints missing "success" field in response.');
  }
  if (withDataField < successResponses.length) {
    console.log('⚠️  Some endpoints missing "data" field in response.');
  }
  if (failedTests === 0 && withSuccessField === successResponses.length && withDataField === successResponses.length) {
    console.log('✅ All APIs are working correctly with proper response structure!');
  }
}

async function main() {
  console.log('🔧 CAFE ADMIN API VERIFICATION');
  console.log('==============================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`JWT Token: ${TEST_JWT_TOKEN ? 'Provided' : 'Not provided (some tests may fail)'}`);
  console.log('');
  
  // Test database connection first
  const dbConnected = await testDatabaseConnection();
  if (!dbConnected) {
    console.log('\n❌ Database connection failed. Some API tests may fail.');
  }
  
  console.log('\n🚀 Testing API Endpoints...\n');
  
  // Test all endpoints
  const results = [];
  for (const endpoint of API_ENDPOINTS) {
    const result = await testAPIEndpoint(endpoint);
    results.push(result);
    console.log(''); // Add spacing between tests
  }
  
  // Generate report
  await generateTestReport(results);
  
  // Close database connection
  await sequelize.close();
  
  console.log('\n🎉 API Verification Complete!');
  
  // Exit with appropriate code
  const allSuccessful = results.every(r => r.success);
  process.exit(allSuccessful ? 0 : 1);
}

// Run the verification
main().catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});
