require('dotenv').config();
const express = require('express');

// Create a simple test server to simulate the frontend request
async function testBusinessAPIEndpoint() {
  try {
    console.log('🔧 Testing Business API Endpoint...');
    
    // Test the actual API endpoint
    const axios = require('axios');
    
    // Make a request to the business API endpoint
    console.log('\n📝 Test 1: Testing GET /api/tenant/business...');
    
    try {
      const response = await axios.get('http://localhost:3000/api/tenant/business', {
        headers: {
          'Authorization': 'Bearer test-token',
          'x-brand-id': '0f4bf72d-ee78-4ec7-8a40-d8d64897e8f0',
          'x-business-id': '0f4bf72d-ee78-4ec7-8a40-d8d64897e8f0',
          'x-panel-type': 'TENANT'
        }
      });
      
      console.log('✅ API Response:', response.status);
      console.log('📦 Response Data:', response.data);
      
    } catch (error) {
      console.log('❌ API Error:', error.message);
      if (error.response) {
        console.log('📦 Error Response:', error.response.data);
        console.log('🔢 Error Status:', error.response.status);
      }
    }
    
    console.log('\n🎉 Business API Endpoint Test Completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testBusinessAPIEndpoint();
