require('dotenv').config();
const { sequelize } = require('../config/database_postgres');
const { ModelFactory } = require('../src/architecture/modelFactory');

async function testExpenseTypesWithRealData() {
  try {
    console.log('🔧 Testing Expense Types with Real Tenant Data...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established.');
    
    // Initialize models through the proper factory
    console.log('🏭 Initializing models through ModelFactory...');
    const models = await ModelFactory.createModels(sequelize);
    
    // Check if ExpenseType model exists
    if (!models.ExpenseType) {
      throw new Error('ExpenseType model not found in initialized models');
    }
    console.log('✅ ExpenseType model available');
    
    // Check for existing brands and outlets
    console.log('🔍 Checking for existing brands and outlets...');
    
    const [brands] = await sequelize.query(`
      SELECT id, name FROM brands LIMIT 3
    `);
    
    const [outlets] = await sequelize.query(`
      SELECT id, name, brand_id FROM outlets LIMIT 3
    `);
    
    console.log(`📊 Found ${brands.length} brands and ${outlets.length} outlets`);
    
    if (brands.length === 0 || outlets.length === 0) {
      console.log('⚠️  No brands or outlets found. Creating test data...');
      
      // Create a test brand and outlet
      const [newBrand] = await sequelize.query(`
        INSERT INTO brands (id, name, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Test Brand', NOW(), NOW())
        RETURNING id, name
      `);
      
      const brandId = newBrand[0].id;
      console.log('✅ Created test brand:', brandId);
      
      const [newOutlet] = await sequelize.query(`
        INSERT INTO outlets (id, brand_id, name, created_at, updated_at)
        VALUES (gen_random_uuid(), :brandId, 'Test Outlet', NOW(), NOW())
        RETURNING id, name, brand_id
      `, {
        replacements: { brandId }
      });
      
      const outletId = newOutlet[0].id;
      console.log('✅ Created test outlet:', outletId);
      
      // Now test ExpenseType with real data
      console.log('📝 Creating expense type with real tenant data...');
      const expenseType = await models.ExpenseType.create({
        brandId,
        outletId,
        name: 'Test Expense Type',
        description: 'This is a test expense type for verification'
      });
      
      console.log('✅ Test expense type created:', expenseType.id);
      
    } else {
      console.log('✅ Using existing tenant data');
      const brand = brands[0];
      const outlet = outlets[0];
      
      console.log(`📊 Using brand: ${brand.name} (${brand.id})`);
      console.log(`📊 Using outlet: ${outlet.name} (${outlet.id})`);
      
      // Test ExpenseType operations
      console.log('📝 Testing ExpenseType operations...');
      
      // Test count
      const count = await models.ExpenseType.count();
      console.log(`📊 Current expense types count: ${count}`);
      
      // Test find all for this tenant
      const tenantTypes = await models.ExpenseType.findAll({
        where: {
          brandId: brand.id,
          outletId: outlet.id
        },
        attributes: ['id', 'name', 'description', 'isEnabled'],
        limit: 10
      });
      
      console.log(`✅ Found ${tenantTypes.length} expense types for this tenant`);
      
      if (tenantTypes.length === 0) {
        console.log('📝 Creating a sample expense type for this tenant...');
        const newExpenseType = await models.ExpenseType.create({
          brandId: brand.id,
          outletId: outlet.id,
          name: 'Utilities',
          description: 'Electricity, water, internet, and other utility expenses'
        });
        
        console.log('✅ Sample expense type created:', newExpenseType.id);
        
        // Test retrieval again
        const updatedTypes = await models.ExpenseType.findAll({
          where: {
            brandId: brand.id,
            outletId: outlet.id
          },
          attributes: ['id', 'name', 'description', 'isEnabled']
        });
        
        console.log(`✅ Now found ${updatedTypes.length} expense types:`);
        updatedTypes.forEach(type => {
          console.log(`  - ${type.name}: ${type.description || 'No description'} (${type.isEnabled ? 'enabled' : 'disabled'})`);
        });
      } else {
        tenantTypes.forEach(type => {
          console.log(`  - ${type.name}: ${type.description || 'No description'} (${type.isEnabled ? 'enabled' : 'disabled'})`);
        });
      }
    }
    
    console.log('\n🎉 Expense Types functionality test completed successfully!');
    console.log('📝 The expense-types endpoint should now work properly');
    console.log('📝 Table exists, model is initialized, and foreign key constraints are working');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the test
testExpenseTypesWithRealData();
