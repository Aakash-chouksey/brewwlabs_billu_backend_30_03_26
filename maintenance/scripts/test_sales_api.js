/**
 * Quick Sales API Test Script
 * Run this to verify the sales APIs are working after the fixes
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'your-jwt-token-here';

// Create axios instance with auth
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// Test functions
const testSalesDashboard = async () => {
  try {
    console.log('🧪 Testing Sales Dashboard API...');
    const response = await api.get('/api/tenant/sales/dashboard');
    
    if (response.data.success) {
      console.log('✅ Sales Dashboard - SUCCESS');
      console.log('📊 Data:', JSON.stringify(response.data.data, null, 2));
    } else {
      console.log('❌ Sales Dashboard - FAILED');
      console.log('Response:', response.data);
    }
  } catch (error) {
    console.log('❌ Sales Dashboard - ERROR');
    console.log('Error:', error.response?.data || error.message);
  }
};

const testSalesPayments = async () => {
  try {
    console.log('🧪 Testing Sales Payments API...');
    const response = await api.get('/api/tenant/sales/payments');
    
    if (response.data.success) {
      console.log('✅ Sales Payments - SUCCESS');
      console.log('💳 Data:', JSON.stringify(response.data.data, null, 2));
    } else {
      console.log('❌ Sales Payments - FAILED');
      console.log('Response:', response.data);
    }
  } catch (error) {
    console.log('❌ Sales Payments - ERROR');
    console.log('Error:', error.response?.data || error.message);
  }
};

const testDailySales = async () => {
  try {
    console.log('🧪 Testing Daily Sales API...');
    const today = new Date().toISOString().split('T')[0];
    const response = await api.get(`/api/tenant/sales/daily?date=${today}`);
    
    if (response.data.success) {
      console.log('✅ Daily Sales - SUCCESS');
      console.log('📈 Data:', JSON.stringify(response.data.data, null, 2));
    } else {
      console.log('❌ Daily Sales - FAILED');
      console.log('Response:', response.data);
    }
  } catch (error) {
    console.log('❌ Daily Sales - ERROR');
    console.log('Error:', error.response?.data || error.message);
  }
};

// Run all tests
const runTests = async () => {
  console.log('🚀 Starting Sales API Tests...');
  console.log('🔗 Base URL:', BASE_URL);
  console.log('🔐 Auth Token:', AUTH_TOKEN.substring(0, 20) + '...');
  console.log('');
  
  await testSalesDashboard();
  console.log('');
  
  await testSalesPayments();
  console.log('');
  
  await testDailySales();
  console.log('');
  
  console.log('🏁 Sales API Tests Complete!');
  console.log('');
  console.log('📝 Next Steps:');
  console.log('1. If all tests pass ✅ - the Op.col issue is fixed');
  console.log('2. If you see errors ❌ - check the error messages');
  console.log('3. Update frontend to use these APIs');
  console.log('4. Test with real user onboarding flow');
};

// Check if auth token is provided
if (!AUTH_TOKEN || AUTH_TOKEN === 'your-jwt-token-here') {
  console.log('❌ Please set AUTH_TOKEN environment variable');
  console.log('💡 Get token from: POST /api/admin/login');
  console.log('   Body: {"email": "admin@brewwlabs.com", "password": "admin123"}');
  process.exit(1);
}

// Run tests
runTests().catch(console.error);
