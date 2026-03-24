require('dotenv').config();
const { sequelize } = require('../config/database_postgres');

async function checkTransactionsTable() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established.');
    
    // Check if Transactions table exists
    const [tableCheck] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'Transactions'
    `);
    
    console.log(`📊 Transactions table exists: ${tableCheck[0].count > 0 ? 'YES' : 'NO'}`);
    
    if (tableCheck[0].count > 0) {
      // Get table structure
      const [columns] = await sequelize.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'Transactions'
        ORDER BY ordinal_position
      `);
      
      console.log('\n📋 Transactions table structure:');
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable}) ${col.column_default || ''}`);
      });
      
      // Get sample data
      const [sampleData] = await sequelize.query('SELECT * FROM "Transactions" LIMIT 3');
      
      if (sampleData.length > 0) {
        console.log('\n📝 Sample transactions data:');
        sampleData.forEach(tx => {
          console.log(`  - ID: ${tx.id}, Type: ${tx.type}, Amount: ${tx.amount}`);
        });
      } else {
        console.log('\n⚠️  No transactions found in table');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sequelize.close();
  }
}

checkTransactionsTable();
