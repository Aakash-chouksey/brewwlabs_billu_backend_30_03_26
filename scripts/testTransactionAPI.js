require('dotenv').config();
const { sequelize } = require('../config/database_postgres');
const Account = require('../models/accountModel');
const Transaction = require('../models/transactionModel');

async function testTransactionAPI() {
  try {
    console.log('🔧 Testing Transaction API...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established.');
    
    // Get a sample tenant context
    const [outletData] = await sequelize.query(`
      SELECT DISTINCT brand_id, id as outlet_id 
      FROM outlets 
      LIMIT 1
    `);
    
    if (outletData.length === 0) {
      console.log('❌ No outlets found in database');
      return;
    }
    
    const { brand_id, outlet_id } = outletData[0];
    console.log('🔍 Using sample outlet:', { brand_id, outlet_id });
    
    // Check existing accounts
    const existingAccounts = await Account.findAll({
      where: { businessId: brand_id, outletId: outlet_id }
    });
    
    console.log(`📊 Existing accounts: ${existingAccounts.length}`);
    
    if (existingAccounts.length === 0) {
      console.log('📝 Creating a test account...');
      
      // Create a test account
      const testAccount = await Account.create({
        name: 'Test Account',
        type: 'Cash',
        balance: 1000,
        businessId: brand_id,
        outletId: outlet_id
      });
      
      console.log('✅ Test account created:', testAccount.id);
      existingAccounts.push(testAccount);
    } else {
      console.log('✅ Using existing account:', existingAccounts[0].name);
    }
    
    const testAccount = existingAccounts[0];
    
    // Test transaction creation scenarios
    console.log('\n🔍 Testing transaction creation scenarios...');
    
    // Test 1: Valid transaction with category
    console.log('\n📝 Test 1: Valid transaction with category');
    try {
      const transaction1 = await Transaction.create({
        accountId: testAccount.id,
        amount: 100,
        type: 'Income',
        category: 'Sales',
        description: 'Test income transaction',
        businessId: brand_id,
        outletId: outlet_id
      });
      
      console.log('✅ Test 1 passed - Transaction created:', transaction1.id);
      
      // Update account balance
      await testAccount.update({ 
        balance: parseFloat(testAccount.balance) + 100 
      });
      
    } catch (error) {
      console.log('❌ Test 1 failed:', error.message);
    }
    
    // Test 2: Valid expense transaction
    console.log('\n📝 Test 2: Valid expense transaction');
    try {
      const transaction2 = await Transaction.create({
        accountId: testAccount.id,
        amount: 50,
        type: 'Expense',
        category: 'Utilities',
        description: 'Test expense transaction',
        businessId: brand_id,
        outletId: outlet_id
      });
      
      console.log('✅ Test 2 passed - Transaction created:', transaction2.id);
      
      // Update account balance
      await testAccount.update({ 
        balance: parseFloat(testAccount.balance) - 50 
      });
      
    } catch (error) {
      console.log('❌ Test 2 failed:', error.message);
    }
    
    // Test 3: Missing category (should fail)
    console.log('\n📝 Test 3: Missing category (should fail)');
    try {
      const transaction3 = await Transaction.create({
        accountId: testAccount.id,
        amount: 75,
        type: 'Income',
        description: 'Test transaction without category',
        businessId: brand_id,
        outletId: outlet_id
      });
      
      console.log('❌ Test 3 unexpectedly passed - this should have failed');
      
    } catch (error) {
      if (error.message.includes('category cannot be null')) {
        console.log('✅ Test 3 passed - Correctly rejected missing category');
      } else {
        console.log('❌ Test 3 failed with unexpected error:', error.message);
      }
    }
    
    // Test 4: Empty category (should fail)
    console.log('\n📝 Test 4: Empty category (should fail)');
    try {
      const transaction4 = await Transaction.create({
        accountId: testAccount.id,
        amount: 75,
        type: 'Income',
        category: '',
        description: 'Test transaction with empty category',
        businessId: brand_id,
        outletId: outlet_id
      });
      
      console.log('❌ Test 4 unexpectedly passed - this should have failed');
      
    } catch (error) {
      if (error.message.includes('category cannot be null')) {
        console.log('✅ Test 4 passed - Correctly rejected empty category');
      } else {
        console.log('❌ Test 4 failed with unexpected error:', error.message);
      }
    }
    
    // Test 5: Valid transaction with whitespace category
    console.log('\n📝 Test 5: Valid transaction with whitespace category');
    try {
      const transaction5 = await Transaction.create({
        accountId: testAccount.id,
        amount: 25,
        type: 'Income',
        category: '  Sales  ',
        description: 'Test transaction with whitespace category',
        businessId: brand_id,
        outletId: outlet_id
      });
      
      console.log('✅ Test 5 passed - Transaction created with trimmed category:', transaction5.id);
      console.log('🔍 Category stored as:', JSON.stringify(transaction5.category));
      
    } catch (error) {
      console.log('❌ Test 5 failed:', error.message);
    }
    
    // Show all transactions
    console.log('\n📋 All transactions created:');
    const allTransactions = await Transaction.findAll({
      where: { businessId: brand_id, outletId: outlet_id },
      attributes: ['id', 'type', 'category', 'amount', 'description', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });
    
    allTransactions.forEach(tx => {
      console.log(`  - ${tx.type}: ${tx.category} - $${tx.amount} (${tx.description || 'No description'})`);
    });
    
    // Show final account balance
    const finalAccount = await Account.findByPk(testAccount.id);
    console.log('\n📊 Final account balance:', finalAccount.balance);
    
    console.log('\n🎉 Transaction API testing completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the test
testTransactionAPI();
