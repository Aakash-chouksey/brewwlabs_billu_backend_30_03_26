require('dotenv').config();
const axios = require('axios');
const { sequelize } = require('../config/database_postgres');

// Test configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';

async function testServerConnection() {
  try {
    console.log('🔍 Testing server connection...');
    const response = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    console.log('✅ Server is running and accessible');
    console.log(`   Status: ${response.status}`);
    return true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Server is not running or not accessible');
      console.log(`   Tried to connect to: ${BASE_URL}`);
      console.log('   Please start the server with: npm start or node app.js');
    } else {
      console.log('❌ Server connection failed:', error.message);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
      }
    }
    return false;
  }
}

async function testAPIResponseStructure() {
  try {
    console.log('🔍 Testing API response structure...');
    
    // Test auth endpoint (should work without token)
    try {
      const authResponse = await axios.post(`${BASE_URL}/api/auth/send-otp`, {
        phone: '1234567890'
      }, { timeout: 5000 });
      
      console.log('✅ Auth endpoint accessible');
      console.log(`   Response has success field: ${authResponse.data && 'success' in authResponse.data ? '✅' : '❌'}`);
      console.log(`   Response structure: ${JSON.stringify(authResponse.data)}`);
    } catch (error) {
      if (error.response?.status === 400 || error.response?.status === 422) {
        console.log('✅ Auth endpoint accessible (returns validation error as expected)');
        console.log(`   Response has success field: ${error.response.data && 'success' in error.response.data ? '✅' : '❌'}`);
        console.log(`   Response structure: ${JSON.stringify(error.response.data)}`);
      } else {
        console.log('❌ Auth endpoint not accessible:', error.message);
      }
    }
    
  } catch (error) {
    console.log('❌ API structure test failed:', error.message);
  }
}

async function testDatabaseModels() {
  try {
    console.log('🔍 Testing database models...');
    
    await sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    // Test importing all models
    const models = [
      'accountModel',
      'areaModel', 
      'categoryModel',
      'expenseTypeModel',
      'orderModel',
      'productModel',
      'productTypeModel',
      'tableModel',
      'transactionModel',
      'userModel'
    ];
    
    for (const modelName of models) {
      try {
        const model = require(`../models/${modelName}`);
        console.log(`✅ ${modelName} loaded successfully`);
      } catch (error) {
        console.log(`❌ ${modelName} failed to load: ${error.message}`);
      }
    }
    
    // Test basic data queries
    const queries = [
      { name: 'Outlets', sql: 'SELECT COUNT(*) as count FROM outlets' },
      { name: 'Categories', sql: 'SELECT COUNT(*) as count FROM categories' },
      { name: 'Products', sql: 'SELECT COUNT(*) as count FROM products' },
      { name: 'Tables', sql: 'SELECT COUNT(*) as count FROM tables' },
      { name: 'Areas', sql: 'SELECT COUNT(*) as count FROM table_areas' },
      { name: 'Orders', sql: 'SELECT COUNT(*) as count FROM orders' }
    ];
    
    console.log('\n📊 Database Statistics:');
    for (const query of queries) {
      try {
        const [result] = await sequelize.query(query.sql);
        console.log(`   ${query.name}: ${result[0].count}`);
      } catch (error) {
        console.log(`   ${query.name}: Error - ${error.message}`);
      }
    }
    
    return true;
  } catch (error) {
    console.log('❌ Database test failed:', error.message);
    return false;
  }
}

async function testControllerExports() {
  try {
    console.log('🔍 Testing controller exports...');
    
    const controllers = [
      'accountingController',
      'areaController',
      'categoryController', 
      'dashboardController',
      'orderController',
      'productController',
      'productTypeController',
      'tableController',
      'userController'
    ];
    
    for (const controllerName of controllers) {
      try {
        const controller = require(`../controllers/${controllerName}`);
        const methods = Object.getOwnPropertyNames(controller).filter(name => typeof controller[name] === 'function');
        console.log(`✅ ${controllerName}: ${methods.join(', ')}`);
      } catch (error) {
        console.log(`❌ ${controllerName} failed to load: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.log('❌ Controller test failed:', error.message);
  }
}

async function checkFrontendIntegration() {
  try {
    console.log('🔍 Checking frontend API integration...');
    
    // Check if frontend API file exists and has proper structure
    const fs = require('fs');
    const path = require('path');
    
    const frontendApiPath = path.join(__dirname, '../../pos-frontend/src/https/index.js');
    
    if (fs.existsSync(frontendApiPath)) {
      console.log('✅ Frontend API file exists');
      
      const apiContent = fs.readFileSync(frontendApiPath, 'utf8');
      
      // Check for key API endpoints
      const keyEndpoints = [
        '/api/tenant/profile',
        '/api/tenant/categories',
        '/api/tenant/products',
        '/api/tenant/tables',
        '/api/tenant/tables-management',
        '/api/tenant/orders',
        '/api/tenant/dashboard'
      ];
      
      console.log('📋 Frontend API endpoints:');
      for (const endpoint of keyEndpoints) {
        const found = apiContent.includes(endpoint);
        console.log(`   ${endpoint}: ${found ? '✅' : '❌'}`);
      }
      
    } else {
      console.log('❌ Frontend API file not found');
    }
    
  } catch (error) {
    console.log('❌ Frontend integration check failed:', error.message);
  }
}

async function generateRecommendations() {
  console.log('\n💡 RECOMMENDATIONS FOR CAFE ADMIN API:');
  console.log('========================================');
  
  console.log('\n🔧 Backend Fixes:');
  console.log('• Ensure all API responses have consistent structure: { success: boolean, data: any }');
  console.log('• Add proper error handling with meaningful error messages');
  console.log('• Implement proper authentication middleware');
  console.log('• Add input validation for all endpoints');
  console.log('• Ensure proper tenant isolation');
  
  console.log('\n📱 Frontend Integration:');
  console.log('• Verify all API endpoints match frontend expectations');
  console.log('• Handle loading states and error states properly');
  console.log('• Implement proper error message display');
  console.log('• Add retry mechanisms for failed requests');
  
  console.log('\n🗄️  Database:');
  console.log('• Ensure all required tables exist');
  console.log('• Add proper indexes for performance');
  console.log('• Implement data validation at model level');
  console.log('• Add proper foreign key constraints');
  
  console.log('\n🔐 Security:');
  console.log('• Implement proper JWT token validation');
  console.log('• Add rate limiting for API endpoints');
  console.log('• Sanitize user inputs');
  console.log('• Implement proper role-based access control');
  
  console.log('\n📊 Monitoring:');
  console.log('• Add API response logging');
  console.log('• Implement error tracking');
  console.log('• Add performance monitoring');
  console.log('• Create health check endpoints');
}

async function main() {
  console.log('🔧 CAFE ADMIN API COMPREHENSIVE VERIFICATION');
  console.log('==========================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('');
  
  // Test server connection
  const serverRunning = await testServerConnection();
  if (!serverRunning) {
    console.log('\n❌ Please start the server before running API tests');
    console.log('   Run: npm start or node app.js');
    process.exit(1);
  }
  
  console.log('');
  
  // Test API response structure
  await testAPIResponseStructure();
  console.log('');
  
  // Test database models
  const dbWorking = await testDatabaseModels();
  console.log('');
  
  // Test controller exports
  await testControllerExports();
  console.log('');
  
  // Check frontend integration
  await checkFrontendIntegration();
  console.log('');
  
  // Generate recommendations
  await generateRecommendations();
  
  // Close database connection
  if (dbWorking) {
    await sequelize.close();
  }
  
  console.log('\n🎉 VERIFICATION COMPLETE!');
  console.log('\n📝 NEXT STEPS:');
  console.log('1. Start the server: npm start');
  console.log('2. Get a valid JWT token by logging in');
  console.log('3. Test APIs with proper authentication');
  console.log('4. Verify frontend integration');
  console.log('5. Test all CRUD operations');
}

// Run the verification
main().catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});
