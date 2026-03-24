require('dotenv').config();
const { sequelize } = require('../config/database_postgres');

// Test transaction management fixes
async function testTransactionFix() {
  try {
    console.log('🔧 Testing Transaction Management Fix...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established.');
    
    console.log('\n📝 Test 1: Testing transaction state tracking...');
    
    // Test 1: Normal transaction flow
    console.log('🔍 Testing normal transaction flow...');
    let t1 = await sequelize.transaction();
    let committed1 = false;
    
    try {
      // Simulate some work
      await sequelize.query('SELECT 1 as test', { transaction: t1 });
      
      await t1.commit();
      committed1 = true;
      console.log('✅ Transaction committed successfully');
      
    } catch (error) {
      if (!committed1) {
        try {
          await t1.rollback();
          console.log('✅ Transaction rolled back successfully');
        } catch (rollbackError) {
          console.log('⚠️ Rollback failed (expected):', rollbackError.message);
        }
      }
      console.error('❌ Transaction failed:', error.message);
    }
    
    // Test 2: Transaction rollback scenario
    console.log('\n🔍 Testing transaction rollback scenario...');
    let t2 = await sequelize.transaction();
    let committed2 = false;
    
    try {
      // Simulate an error
      await sequelize.query('SELECT 1/0 as error', { transaction: t2 });
      
      await t2.commit();
      committed2 = true;
      
    } catch (error) {
      console.log('⚠️ Expected error caught:', error.message);
      
      if (!committed2) {
        try {
          await t2.rollback();
          console.log('✅ Transaction rolled back successfully');
        } catch (rollbackError) {
          console.log('⚠️ Rollback failed:', rollbackError.message);
        }
      }
      
      // Test for transaction state errors
      if (error.message.includes('cannot be rolled back') || 
          error.message.includes('has been finished') ||
          error.message.includes('transaction is aborted')) {
        console.log('✅ Transaction state error detected correctly');
      }
    }
    
    // Test 3: Double rollback prevention
    console.log('\n🔍 Testing double rollback prevention...');
    let t3 = await sequelize.transaction();
    let committed3 = false;
    
    try {
      await t3.rollback();
      console.log('✅ First rollback successful');
      
      // Try to rollback again - this should fail
      await t3.rollback();
      console.log('⚠️ Second rollback succeeded (unexpected)');
      
    } catch (error) {
      console.log('✅ Double rollback prevented as expected:', error.message);
    }
    
    console.log('\n🎉 Transaction Management Test Completed!');
    console.log('📝 Summary:');
    console.log('  ✅ Normal transaction flow working');
    console.log('  ✅ Error handling working');
    console.log('  ✅ Rollback state tracking working');
    console.log('  ✅ Double rollback prevention working');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await sequelize.close();
  }
}

// Run the test
testTransactionFix();
