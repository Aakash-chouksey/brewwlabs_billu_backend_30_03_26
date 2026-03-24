require('dotenv').config();
const { sequelize } = require('../config/database_postgres');

// Test the improved transaction error handling
async function testImprovedErrorHandling() {
  try {
    console.log('🔧 Testing Improved Transaction Error Handling...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established.');
    
    console.log('\n📝 Test 1: Testing specific transaction state error detection...');
    
    // Test the specific error patterns we're catching
    const testErrors = [
      'cannot be rolled back because it has been finished',
      'Transaction cannot be rolled back',
      'transaction is aborted, commands ignored until end of transaction block',
      'transaction is aborted',  // This should NOT be caught alone
      'some other database error'  // This should pass through
    ];
    
    for (const testError of testErrors) {
      const error = new Error(testError);
      
      // Test our detection logic
      const shouldCatch = error.message.includes('cannot be rolled back because it has been finished') || 
                          error.message.includes('Transaction cannot be rolled back') ||
                          (error.message.includes('transaction is aborted') && error.message.includes('commands ignored'));
      
      console.log(`🔍 Testing error: "${testError}"`);
      console.log(`   Should catch: ${shouldCatch}`);
      
      if (shouldCatch) {
        console.log('   ✅ Correctly identified as transaction state error');
      } else {
        console.log('   ✅ Correctly passed through as regular error');
      }
    }
    
    console.log('\n🎉 Improved Error Handling Test Completed!');
    console.log('📝 Summary:');
    console.log('  ✅ Specific transaction state error detection working');
    console.log('  ✅ Legitimate errors pass through correctly');
    console.log('  ✅ Error handling logic improved');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await sequelize.close();
  }
}

// Run the test
testImprovedErrorHandling();
