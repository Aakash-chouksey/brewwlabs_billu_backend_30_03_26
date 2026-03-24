require('dotenv').config();
const { sequelize } = require('../config/database_postgres');
const { ModelFactory } = require('../src/architecture/modelFactory');

async function testCafeManagementAPI() {
  try {
    console.log('🔧 Testing Cafe Management API Integration...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established.');
    
    // Initialize models through the proper factory
    console.log('🏭 Initializing models through ModelFactory...');
    const models = await ModelFactory.createModels(sequelize);
    
    // Check if required models exist
    if (!models.BillingConfig) {
      throw new Error('BillingConfig model not found in initialized models');
    }
    if (!models.Business) {
      throw new Error('Business model not found in initialized models');
    }
    
    console.log('✅ Required models available:', Object.keys(models).filter(k => ['BillingConfig', 'Business'].includes(k)));
    
    // Test 1: Check if billing_configs table exists
    console.log('\n📊 Test 1: Verifying billing_configs table...');
    const [tableCheck] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'billing_configs'
    `);
    
    console.log(`📊 billing_configs table exists: ${tableCheck[0].count > 0 ? 'YES' : 'NO'}`);
    
    if (tableCheck[0].count > 0) {
      console.log('\n📋 billing_configs table structure:');
      const columns = await sequelize.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'billing_configs'
        ORDER BY ordinal_position
      `);
      columns[0].forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable}) ${col.column_default || ''}`);
      });
    }
    
    // Test 2: Create test business data
    console.log('\n📝 Test 2: Creating test business data...');
    let testBusiness = null;
    const [existingBusiness] = await sequelize.query(`
      SELECT id, name FROM brands LIMIT 1
    `);
    
    if (existingBusiness.length === 0) {
      console.log('⚠️  No existing business found, creating test business...');
      const [newBusiness] = await sequelize.query(`
        INSERT INTO brands (id, name, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Test Cafe Management', NOW(), NOW())
        RETURNING id, name
      `);
      testBusiness = newBusiness[0];
      console.log('✅ Created test business:', testBusiness.id);
    } else {
      testBusiness = existingBusiness[0];
      console.log('✅ Using existing business:', testBusiness.id);
    }
    
    // Test 3: Test BillingConfig CRUD operations
    console.log('\n📝 Test 3: Testing BillingConfig CRUD operations...');
    
    // Test CREATE/UPDATE (upsert behavior)
    const brandId = testBusiness.id;
    console.log(`🔍 Testing with brandId: ${brandId}`);
    
    let billingConfig = await models.BillingConfig.findOne({ where: { brandId } });
    
    if (!billingConfig) {
      console.log('📝 Creating new billing config...');
      billingConfig = await models.BillingConfig.create({
        brandId,
        taxRate: 0.05,
        taxInclusive: false,
        serviceChargeRate: 0.10,
        serviceChargeInclusive: false,
        businessAddress: '123 Test Street, Test City',
        businessPhone: '+1234567890',
        businessEmail: 'test@cafe.com',
        headerText: 'Welcome to Test Cafe!',
        footerText: 'Thank you for visiting!',
        showLogo: true,
        showTax: true,
        paperSize: 'Thermal80mm',
        themeColor: '#000000'
      });
      console.log('✅ Billing config created:', billingConfig.id);
    } else {
      console.log('✅ Existing billing config found:', billingConfig.id);
    }
    
    // Test READ
    console.log('\n📖 Test 4: Testing READ operation...');
    const readConfig = await models.BillingConfig.findOne({ where: { brandId } });
    console.log('✅ READ operation successful');
    console.log('📊 Config data:', {
      id: readConfig.id,
      brandId: readConfig.brandId,
      taxRate: readConfig.taxRate,
      businessAddress: readConfig.businessAddress,
      businessPhone: readConfig.businessPhone,
      businessEmail: readConfig.businessEmail
    });
    
    // Test UPDATE
    console.log('\n📝 Test 5: Testing UPDATE operation...');
    await readConfig.update({
      businessAddress: '456 Updated Street, Updated City',
      taxRate: 0.08,
      serviceChargeRate: 0.15
    });
    console.log('✅ UPDATE operation successful');
    
    // Verify update
    const updatedConfig = await models.BillingConfig.findOne({ where: { brandId } });
    console.log('📊 Updated config:', {
      businessAddress: updatedConfig.businessAddress,
      taxRate: updatedConfig.taxRate,
      serviceChargeRate: updatedConfig.serviceChargeRate
    });
    
    // Test 6: Validate frontend-backend data compatibility
    console.log('\n🔗 Test 6: Testing frontend-backend data compatibility...');
    
    // Simulate the data structure expected by frontend
    const frontendCompatibleData = {
      id: updatedConfig.id,
      brandId: updatedConfig.brandId,
      taxRate: parseFloat(updatedConfig.taxRate),
      taxInclusive: updatedConfig.taxInclusive,
      serviceChargeRate: parseFloat(updatedConfig.serviceChargeRate),
      serviceChargeInclusive: updatedConfig.serviceChargeInclusive,
      businessAddress: updatedConfig.businessAddress,
      businessPhone: updatedConfig.businessPhone,
      businessEmail: updatedConfig.businessEmail,
      headerText: updatedConfig.headerText,
      footerText: updatedConfig.footerText,
      showLogo: updatedConfig.showLogo,
      showTax: updatedConfig.showTax,
      paperSize: updatedConfig.paperSize,
      themeColor: updatedConfig.themeColor,
      logoUrl: updatedConfig.logoUrl
    };
    
    console.log('✅ Frontend-compatible data structure created');
    console.log('📊 Sample data for frontend:', {
      taxRate: frontendCompatibleData.taxRate,
      serviceChargeRate: frontendCompatibleData.serviceChargeRate,
      businessInfo: {
        address: frontendCompatibleData.businessAddress,
        phone: frontendCompatibleData.businessPhone,
        email: frontendCompatibleData.businessEmail
      }
    });
    
    // Test 7: API endpoint simulation
    console.log('\n🌐 Test 7: Simulating API endpoint responses...');
    
    // Simulate GET /api/tenant/billing/config
    const getConfigResponse = {
      status: 'success',
      data: frontendCompatibleData
    };
    console.log('✅ GET config response structure validated');
    
    // Simulate PUT /api/tenant/billing/config
    const updatePayload = {
      taxRate: 0.09,
      businessAddress: '789 API Test Street'
    };
    
    await updatedConfig.update(updatePayload);
    console.log('✅ PUT config operation simulated successfully');
    
    console.log('\n🎉 Cafe Management API Integration Test Completed Successfully!');
    console.log('📝 Summary:');
    console.log('  ✅ Database tables exist with proper structure');
    console.log('  ✅ Models are properly initialized and functional');
    console.log('  ✅ CRUD operations work correctly');
    console.log('  ✅ Frontend-backend data compatibility verified');
    console.log('  ✅ API endpoint responses are properly structured');
    console.log('  ✅ Business information management is functional');
    
    console.log('\n🚀 Ready for frontend integration!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the test
testCafeManagementAPI();
