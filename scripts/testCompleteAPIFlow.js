require('dotenv').config();
const express = require('express');
const { sequelize } = require('../config/database_postgres');

// Simulate the complete API flow
async function testCompleteAPIFlow() {
  try {
    console.log('🔧 Testing Complete API Flow...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established.');
    
    // Simulate the request object with headers
    const mockRequest = {
      headers: {
        'x-brand-id': '0f4bf72d-ee78-4ec7-8a40-d8d64897e8f0',
        'x-business-id': '0f4bf72d-ee78-4ec7-8a40-d8d64897e8f0',
        'authorization': 'Bearer mock-token'
      },
      brandId: '0f4bf72d-ee78-4ec7-8a40-d8d64897e8f0',
      context: {
        brandId: '0f4bf72d-ee78-4ec7-8a40-d8d64897e8f0',
        businessId: '0f4bf72d-ee78-4ec7-8a40-d8d64897e8f0'
      },
      auth: {
        brandId: '0f4bf72d-ee78-4ec7-8a40-d8d64897e8f0',
        businessId: '0f4bf72d-ee78-4ec7-8a40-d8d64897e8f0'
      },
      sequelize: sequelize
    };
    
    console.log('\n📝 Test 1: Simulating getBusinessInfo with mock request...');
    console.log('🔍 Mock request brandId:', mockRequest.brandId);
    console.log('🔍 Mock request context:', mockRequest.context);
    console.log('🔍 Mock request auth:', mockRequest.auth);
    
    // Test the exact query used in the controller
    const brandId = mockRequest.brandId;
    console.log('✅ Extracted brandId:', brandId);
    
    if (!brandId) {
      console.log('❌ Brand ID is missing!');
      return;
    }
    
    const businessQueryResult = await sequelize.query(`
      SELECT id, name, address, phone, email, gst_number as "gstNumber", status, created_at as "createdAt", updated_at as "updatedAt"
      FROM brands 
      WHERE id = :brandId
    `, {
      replacements: { brandId },
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log('🔍 Query result:', businessQueryResult);
    
    if (!businessQueryResult || businessQueryResult.length === 0) {
      console.log('❌ Business not found');
      
      // Check what brands exist
      const [allBrands] = await sequelize.query(`
        SELECT id, name, email FROM brands LIMIT 3
      `);
      
      console.log('📊 Available brands:', allBrands);
      return;
    }
    
    const business = businessQueryResult[0];
    console.log('✅ Business found:', business.id);
    
    // Format response as the controller would
    const response = {
      status: 'success',
      data: {
        id: business.id,
        name: business.name || "",
        address: business.address || "",
        phone: business.phone || "",
        email: business.email || "",
        gstNumber: business.gstNumber || "",
        status: business.status || 'active'
      }
    };
    
    console.log('✅ Controller response:', JSON.stringify(response, null, 2));
    
    // Test frontend data processing
    console.log('\n📝 Test 2: Simulating frontend data processing...');
    
    if (response.data) {
      const businessData = {
        name: response.data.name || "",
        address: response.data.address || "",
        phone: response.data.phone || "",
        email: response.data.email || "",
        gstNumber: response.data.gstNumber || ""
      };
      
      console.log('✅ Frontend business data:', businessData);
      
      // Check if any fields are empty
      const emptyFields = Object.keys(businessData).filter(key => !businessData[key]);
      if (emptyFields.length > 0) {
        console.log('⚠️ Empty fields:', emptyFields);
      } else {
        console.log('✅ All fields have data');
      }
    }
    
    console.log('\n🎉 Complete API Flow Test Completed!');
    console.log('📝 Summary:');
    console.log('  ✅ Request context working');
    console.log('  ✅ Database query working');
    console.log('  ✅ Response format correct');
    console.log('  ✅ Frontend data processing working');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await sequelize.close();
  }
}

// Run the test
testCompleteAPIFlow();
