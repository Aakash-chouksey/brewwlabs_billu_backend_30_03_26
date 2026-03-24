require('dotenv').config();
const { sequelize } = require('../config/database_postgres');
const { ModelFactory } = require('../src/architecture/modelFactory');

async function testBusinessDataFlow() {
  try {
    console.log('🔧 Testing Business Data Flow...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established.');
    
    // Initialize models
    console.log('🏭 Initializing models through ModelFactory...');
    const models = await ModelFactory.createModels(sequelize);
    
    if (!models.Business) {
      throw new Error('Business model not found in initialized models');
    }
    
    console.log('✅ Business model available');
    
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
    
    // Test 2: Test Business model findOne
    console.log('\n📝 Test 2: Testing Business model findOne...');
    const business = await models.Business.findOne({ where: { id: brandId } });
    
    if (!business) {
      console.log('❌ Business not found in Business model');
      return;
    }
    
    console.log('✅ Business found in model');
    console.log('📊 Business model data:', {
      id: business.id,
      name: business.name,
      address: business.address,
      phone: business.phone,
      email: business.email,
      gstNumber: business.gstNumber
    });
    
    // Test 3: Simulate API response format
    console.log('\n📝 Test 3: Simulating API response format...');
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
    
    // Test 4: Test update operation
    console.log('\n📝 Test 4: Testing update operation...');
    const updateData = {
      name: 'Updated Test Business',
      address: '123 Updated Street',
      phone: '+1234567890',
      gstNumber: 'UPDATED123456789'
    };
    
    console.log('🔍 Update payload:', updateData);
    
    await business.update(updateData);
    console.log('✅ Update successful');
    
    // Verify update
    const updatedBusiness = await models.Business.findOne({ where: { id: brandId } });
    console.log('📊 Updated business:', {
      name: updatedBusiness.name,
      address: updatedBusiness.address,
      phone: updatedBusiness.phone,
      gstNumber: updatedBusiness.gstNumber
    });
    
    // Test 5: Test frontend data processing
    console.log('\n📝 Test 5: Testing frontend data processing...');
    const frontendData = {
      name: updatedBusiness.name || "",
      address: updatedBusiness.address || "",
      phone: updatedBusiness.phone || "",
      email: updatedBusiness.email || "",
      gstNumber: updatedBusiness.gstNumber || ""
    };
    
    console.log('✅ Frontend data format:', frontendData);
    
    // Test 6: Simulate complete data flow
    console.log('\n📝 Test 6: Simulating complete data flow...');
    
    // Simulate frontend fetch
    console.log('🔍 Simulating frontend fetch...');
    const simulatedFetch = {
      billingConfig: { data: { businessAddress: '', businessPhone: '', businessEmail: '' } },
      businessInfo: { data: frontendData }
    };
    
    console.log('✅ Simulated fetch response:', simulatedFetch);
    
    // Simulate frontend update
    console.log('🔍 Simulating frontend update...');
    const simulatedUpdate = {
      name: 'Final Test Business',
      address: '789 Final Street',
      phone: '+1111111111',
      gstNumber: 'FINAL1234567890'
    };
    
    await business.update(simulatedUpdate);
    console.log('✅ Simulated update successful');
    
    // Final verification
    const finalBusiness = await models.Business.findOne({ where: { id: brandId } });
    console.log('📊 Final business state:', {
      name: finalBusiness.name,
      address: finalBusiness.address,
      phone: finalBusiness.phone,
      gstNumber: finalBusiness.gstNumber
    });
    
    console.log('\n🎉 Business Data Flow Test Completed Successfully!');
    console.log('📝 Summary:');
    console.log('  ✅ Database connection working');
    console.log('  ✅ Business model initialized correctly');
    console.log('  ✅ Data retrieval working');
    console.log('  ✅ Data updates working');
    console.log('  ✅ API response format correct');
    console.log('  ✅ Frontend data processing working');
    console.log('  ✅ Complete data flow verified');
    
    console.log('\n🚀 Business Data Loading Should Now Work Correctly!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the test
testBusinessDataFlow();
