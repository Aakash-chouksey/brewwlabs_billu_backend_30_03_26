require('dotenv').config();
const { sequelize } = require('../config/database_postgres');

async function testAndCreateTables() {
  try {
    console.log('🔧 Testing database connection and creating tables...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established.');
    
    // Check current tables
    console.log('📊 Current tables in database:');
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('Existing tables:');
    tables.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Create Accounts table if it doesn't exist
    console.log('\n📝 Creating Accounts table...');
    try {
      await sequelize.query(`
        CREATE TABLE "Accounts" (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            type VARCHAR(50) DEFAULT 'Cash',
            balance DECIMAL(10,2) DEFAULT 0,
            "businessId" UUID NOT NULL,
            "outletId" UUID NOT NULL,
            status VARCHAR(20) DEFAULT 'active',
            "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Accounts table created successfully');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ Accounts table already exists');
      } else {
        console.log('❌ Error creating Accounts table:', error.message);
      }
    }
    
    // Create Transactions table if it doesn't exist
    console.log('📝 Creating Transactions table...');
    try {
      await sequelize.query(`
        CREATE TABLE "Transactions" (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            type VARCHAR(50) NOT NULL,
            category VARCHAR(255) NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            description TEXT,
            "accountId" UUID NOT NULL,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "businessId" UUID NOT NULL,
            "outletId" UUID NOT NULL,
            "performedBy" UUID,
            "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Transactions table created successfully');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ Transactions table already exists');
      } else {
        console.log('❌ Error creating Transactions table:', error.message);
      }
    }
    
    // Verify tables exist
    console.log('\n🔍 Verifying accounting tables...');
    const [accountsCheck] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'Accounts'
    `);
    
    const [transactionsCheck] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'Transactions'
    `);
    
    console.log(`📊 Accounts table exists: ${accountsCheck[0].count > 0 ? 'YES' : 'NO'}`);
    console.log(`📊 Transactions table exists: ${transactionsCheck[0].count > 0 ? 'YES' : 'NO'}`);
    
    // If tables exist, show their structure
    if (accountsCheck[0].count > 0) {
      console.log('\n📋 Accounts table structure:');
      const accountsColumns = await sequelize.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'Accounts'
        ORDER BY ordinal_position
      `);
      accountsColumns[0].forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable}) ${col.column_default || ''}`);
      });
    }
    
    if (transactionsCheck[0].count > 0) {
      console.log('\n📋 Transactions table structure:');
      const transactionsColumns = await sequelize.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'Transactions'
        ORDER BY ordinal_position
      `);
      transactionsColumns[0].forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable}) ${col.column_default || ''}`);
      });
    }
    
    console.log('\n🎉 Accounting tables setup completed!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the test
testAndCreateTables();
