require('dotenv').config();
const express = require('express');
const { sequelize } = require('../config/database_postgres');

// Test the business API endpoints directly
async function testBusinessAPIEndpoints() {
  try {
    console.log('🔧 Testing Business API Endpoints...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established.');
    
    // Simulate the business controller logic
    const brandId = '0f4bf72d-ee78-4ec7-8a40-d8d64897e8f0'; // Use a known brand ID
    
    console.log('\n📝 Test 1: Simulating getBusinessInfo endpoint...');
    
    // Test the exact query used in the controller
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
      console.log('❌ Business not found - this could be the issue!');
      
      // Let's check what brands exist
      const [allBrands] = await sequelize.query(`
        SELECT id, name, email FROM brands LIMIT 5
      `);
      
      console.log('📊 Available brands:', allBrands);
      
      if (allBrands.length > 0) {
        console.log('🔍 Trying with first available brand:', allBrands[0].id);
        
        // Try with the first available brand
        const testQueryResult = await sequelize.query(`
          SELECT id, name, address, phone, email, gst_number as "gstNumber", status, created_at as "createdAt", updated_at as "updatedAt"
          FROM brands 
          WHERE id = :brandId
        `, {
          replacements: { brandId: allBrands[0].id },
          type: sequelize.QueryTypes.SELECT
        });
        
        console.log('✅ Test query result:', testQueryResult);
        
        if (testQueryResult.length > 0) {
          const business = testQueryResult[0];
          console.log('📊 Business data found:', {
            id: business.id,
            name: business.name,
            address: business.address,
            phone: business.phone,
            email: business.email,
            gstNumber: business.gstNumber
          });
          
          // Format as the API would
          const apiResponse = {
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
          
          console.log('✅ API response format:', JSON.stringify(apiResponse, null, 2));
        }
      }
    } else {
      const business = businessQueryResult[0];
      console.log('✅ Business found:', business.id);
      console.log('📊 Business data:', {
        id: business.id,
        name: business.name,
        address: business.address,
        phone: business.phone,
        email: business.email,
        gstNumber: business.gstNumber
      });
    }
    
    console.log('\n🎉 Business API Test Completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await sequelize.close();
  }
}

// Run the test
testBusinessAPIEndpoints();
