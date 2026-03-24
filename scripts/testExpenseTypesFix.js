require('dotenv').config();
const { sequelize } = require('../config/database_postgres');
const { ModelFactory } = require('../src/architecture/modelFactory');

async function testExpenseTypesEndpoint() {
  try {
    console.log('🔧 Testing Expense Types with Proper Model Factory...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established.');
    
    // Initialize models through the proper factory
    console.log('🏭 Initializing models through ModelFactory...');
    const models = await ModelFactory.createModels(sequelize);
    console.log('✅ Models initialized:', Object.keys(models));
    
    // Check if ExpenseType model exists
    if (!models.ExpenseType) {
      throw new Error('ExpenseType model not found in initialized models');
    }
    console.log('✅ ExpenseType model available');
    
    // Test model functionality
    console.log('📊 Testing ExpenseType model operations...');
    
    // Test count
    const count = await models.ExpenseType.count();
    console.log(`📊 Total expense types in database: ${count}`);
    
    // Test find all
    const allTypes = await models.ExpenseType.findAll({
      attributes: ['id', 'name', 'description', 'isEnabled'],
      limit: 5
    });
    
    if (allTypes.length > 0) {
      console.log('✅ Sample expense types from model:');
      allTypes.forEach(type => {
        console.log(`  - ${type.name}: ${type.description || 'No description'} (${type.isEnabled ? 'enabled' : 'disabled'})`);
      });
    } else {
      console.log('ℹ️  No expense types found, creating a test entry...');
      
      // Create a test expense type
      const testExpenseType = await models.ExpenseType.create({
        brandId: '00000000-0000-0000-0000-000000000000', // Test brand ID
        outletId: '00000000-0000-0000-0000-000000000000', // Test outlet ID
        name: 'Test Expense Type',
        description: 'This is a test expense type for verification'
      });
      
      console.log('✅ Test expense type created:', testExpenseType.id);
      
      // Test retrieval again
      const updatedCount = await models.ExpenseType.count();
      console.log(`📊 Updated total expense types: ${updatedCount}`);
    }
    
    console.log('\n🎉 Expense Types model test completed successfully!');
    console.log('📝 The expense-types endpoint should now work properly');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the test
testExpenseTypesEndpoint();
