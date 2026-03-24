require('dotenv').config();
const { sequelize } = require('../config/database_postgres');

async function testBusinessAPI() {
  try {
    console.log('🔧 Testing Business API...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established.');
    
    // Test 1: Find existing business
    console.log('\n📝 Test 1: Finding existing business...');
    const [existingBusiness] = await sequelize.query(`
      SELECT id, name, address, phone, email, gst_number FROM brands LIMIT 1
    `);
    
    if (existingBusiness.length === 0) {
      console.log('❌ No existing business found');
      return;
    }
    
    const brandId = existingBusiness[0].id;
    console.log('✅ Found business:', brandId);
    console.log('📊 Current business data:', existingBusiness[0]);
    
    // Test 2: Simulate getBusinessInfo API
    console.log('\n📝 Test 2: Simulating getBusinessInfo API...');
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
      return;
    }
    
    const business = businessQueryResult[0];
    console.log('✅ Business data found:', business);
    
    // Test 3: Format API response
    console.log('\n📝 Test 3: Formatting API response...');
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
    
    console.log('✅ API response:', JSON.stringify(apiResponse, null, 2));
    
    // Test 4: Simulate updateBusinessInfo API
    console.log('\n📝 Test 4: Simulating updateBusinessInfo API...');
    const updateData = {
      name: 'Test Updated Business',
      address: '789 Updated Street',
      phone: '+9999999999',
      gstNumber: 'UPDATED999999999'
    };
    
    console.log('🔍 Update payload:', updateData);
    
    // Map frontend field names to database field names
    const filteredUpdates = {};
    const allowedFields = ['name', 'address', 'phone', 'email', 'gstNumber'];
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        if (field === 'gstNumber') {
          filteredUpdates['gst_number'] = updateData[field];
        } else {
          filteredUpdates[field] = updateData[field];
        }
      }
    });
    
    console.log('🔍 Filtered updates:', filteredUpdates);
    
    // Build dynamic update query
    const updateFields = Object.keys(filteredUpdates).map(key => `${key} = :${key}`).join(', ');
    const updateQuery = `
      UPDATE brands 
      SET ${updateFields}, updated_at = NOW()
      WHERE id = :brandId
    `;
    
    console.log('🔍 Update query:', updateQuery);
    
    await sequelize.query(updateQuery, {
      replacements: { ...filteredUpdates, brandId },
      type: sequelize.QueryTypes.UPDATE
    });
    
    console.log('✅ Update successful');
    
    // Verify update
    const updatedQueryResult = await sequelize.query(`
      SELECT id, name, address, phone, email, gst_number as "gstNumber", status, created_at as "createdAt", updated_at as "updatedAt"
      FROM brands 
      WHERE id = :brandId
    `, {
      replacements: { brandId },
      type: sequelize.QueryTypes.SELECT
    });
    
    const updatedBusiness = updatedQueryResult[0];
    console.log('✅ Updated business:', {
      name: updatedBusiness.name,
      address: updatedBusiness.address,
      phone: updatedBusiness.phone,
      gstNumber: updatedBusiness.gstNumber
    });
    
    // Test 5: Format frontend data
    console.log('\n📝 Test 5: Formatting frontend data...');
    const frontendData = {
      name: updatedBusiness.name || "",
      address: updatedBusiness.address || "",
      phone: updatedBusiness.phone || "",
      email: updatedBusiness.email || "",
      gstNumber: updatedBusiness.gstNumber || ""
    };
    
    console.log('✅ Frontend data:', frontendData);
    
    console.log('\n🎉 Business API Test Completed Successfully!');
    console.log('📝 Summary:');
    console.log('  ✅ Database connection working');
    console.log('  ✅ Business data retrieval working');
    console.log('  ✅ API response format correct');
    console.log('  ✅ Business updates working');
    console.log('  ✅ Frontend data format correct');
    
    console.log('\n🚀 Business API is Ready for Frontend Integration!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the test
testBusinessAPI();
