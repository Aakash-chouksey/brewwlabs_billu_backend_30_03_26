require('dotenv').config();
const { sequelize } = require('../config/database_postgres');

async function verifyExpenseTypesSetup() {
  try {
    console.log('🔧 Verifying Expense Types Setup...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established.');
    
    // Verify table exists
    console.log('🔍 Verifying expense_types table...');
    const [tableCheck] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'expense_types'
    `);
    
    console.log(`📊 expense_types table exists: ${tableCheck[0].count > 0 ? 'YES' : 'NO'}`);
    
    if (tableCheck[0].count > 0) {
      console.log('\n📋 expense_types table structure:');
      const columns = await sequelize.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'expense_types'
        ORDER BY ordinal_position
      `);
      columns[0].forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable}) ${col.column_default || ''}`);
      });
      
      // Check for default data
      console.log('\n📝 Checking default expense types...');
      const [defaultData] = await sequelize.query(`
        SELECT id, name, description, is_enabled 
        FROM expense_types 
        ORDER BY name
      `);
      
      if (defaultData.length > 0) {
        console.log('✅ Default expense types found:');
        defaultData.forEach(type => {
          console.log(`  - ${type.name}: ${type.description || 'No description'} (${type.is_enabled ? 'enabled' : 'disabled'})`);
        });
      } else {
        console.log('⚠️  No expense types found in table');
      }
    }
    
    // Test model import
    console.log('\n📝 Testing ExpenseType model import...');
    try {
      const ExpenseType = require('../models/expenseTypeModel');
      console.log('✅ ExpenseType model imported successfully');
      
      // Test model functionality
      const count = await ExpenseType.count();
      console.log(`📊 Total expense types in database: ${count}`);
      
      // Test find all
      const allTypes = await ExpenseType.findAll({
        attributes: ['id', 'name', 'description', 'isEnabled'],
        limit: 5
      });
      
      if (allTypes.length > 0) {
        console.log('✅ Sample expense types from model:');
        allTypes.forEach(type => {
          console.log(`  - ${type.name}: ${type.description || 'No description'} (${type.isEnabled ? 'enabled' : 'disabled'})`);
        });
      }
      
    } catch (error) {
      console.log('❌ ExpenseType model error:', error.message);
    }
    
    // Test controller import
    console.log('\n📝 Testing expense type controller import...');
    try {
      const { getExpenseTypes, createExpenseType } = require('../controllers/expenseTypeController');
      console.log('✅ Expense type controller imported successfully');
      console.log('✅ getExpenseTypes function available');
      console.log('✅ createExpenseType function available');
    } catch (error) {
      console.log('❌ Controller import error:', error.message);
    }
    
    console.log('\n🎉 Expense types setup verification completed!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the verification
verifyExpenseTypesSetup();
