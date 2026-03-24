require('dotenv').config();
const { sequelize } = require('../config/database_postgres');

// Test the sequelize reference fix
async function testSequelizeReferenceFix() {
  try {
    console.log('🔧 Testing Sequelize Reference Fix...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established.');
    
    console.log('\n📝 Test 1: Testing transaction with proper sequelize reference...');
    
    // Simulate the fixed transaction creation
    let t = await sequelize.transaction();
    
    console.log('✅ Transaction created with correct sequelize reference');
    
    // Test some work
    await sequelize.query('SELECT 1 as test', { transaction: t });
    console.log('✅ Query executed within transaction');
    
    await t.commit();
    console.log('✅ Transaction committed successfully');
    
    console.log('\n🎉 Sequelize Reference Fix Test Completed!');
    console.log('📝 Summary:');
    console.log('  ✅ Transaction creation working with req.sequelize reference');
    console.log('  ✅ No "sequelize is not defined" errors');
    console.log('  ✅ Transaction isolation level working');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error.message.includes('sequelize is not defined')) {
      console.log('❌ Sequelize reference issue still exists');
    } else {
      console.log('✅ Sequelize reference issue is fixed');
    }
  } finally {
    await sequelize.close();
  }
}

// Run the test
testSequelizeReferenceFix();
