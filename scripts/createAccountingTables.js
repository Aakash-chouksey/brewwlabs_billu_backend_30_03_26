require('dotenv').config();
const { sequelize } = require('../config/database_postgres');

async function createAccountingTables() {
  try {
    console.log('🔧 Creating Accounting Tables...');
    
    // Check if connection is established
    await sequelize.authenticate();
    console.log('✅ Database connection established.');
    
    // Create Accounts table
    console.log('📝 Creating Accounts table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "Accounts" (
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
    
    // Create Transactions table
    console.log('📝 Creating Transactions table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "Transactions" (
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
    
    // Create indexes for Accounts
    console.log('📝 Creating indexes for Accounts...');
    await sequelize.query(`CREATE INDEX IF NOT EXISTS "Accounts_business_idx" ON "Accounts" ("businessId")`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS "Accounts_outlet_idx" ON "Accounts" ("outletId")`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS "Accounts_business_outlet_idx" ON "Accounts" ("businessId", "outletId")`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS "Accounts_name_idx" ON "Accounts" ("name")`);
    console.log('✅ Accounts indexes created');
    
    // Create indexes for Transactions
    console.log('📝 Creating indexes for Transactions...');
    await sequelize.query(`CREATE INDEX IF NOT EXISTS "Transactions_business_idx" ON "Transactions" ("businessId")`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS "Transactions_outlet_idx" ON "Transactions" ("outletId")`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS "Transactions_business_outlet_idx" ON "Transactions" ("businessId", "outletId")`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS "Transactions_account_idx" ON "Transactions" ("accountId")`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS "Transactions_date_idx" ON "Transactions" ("date")`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS "Transactions_type_idx" ON "Transactions" ("type")`);
    console.log('✅ Transactions indexes created');
    
    // Add foreign key constraint for Transactions to Accounts
    console.log('📝 Adding foreign key constraints...');
    try {
      await sequelize.query(`
        ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_account_fkey" 
        FOREIGN KEY ("accountId") REFERENCES "Accounts" ("id") ON DELETE CASCADE
      `);
      console.log('✅ Transactions-Accounts foreign key added');
    } catch (error) {
      console.log('⚠️  Foreign key already exists or failed:', error.message);
    }
    
    // Verify tables exist
    console.log('🔍 Verifying tables...');
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
    
    // Insert default accounts if they don't exist
    console.log('📝 Checking for default accounts...');
    try {
      const [defaultAccountsCheck] = await sequelize.query(`
        SELECT COUNT(*) as count FROM "Accounts" 
        WHERE name IN ('Cash Account', 'Bank Account')
      `);
      
      if (defaultAccountsCheck[0].count === 0) {
        console.log('📝 Inserting default accounts...');
        
        // Get a sample business and outlet for default accounts
        const [sampleTenant] = await sequelize.query(`
          SELECT business_id, outlet_id 
          FROM outlets 
          LIMIT 1
        `);
        
        if (sampleTenant.length > 0) {
          const { business_id, outlet_id } = sampleTenant[0];
          
          await sequelize.query(`
            INSERT INTO "Accounts" (name, type, balance, "businessId", "outletId", "createdAt", "updatedAt")
            VALUES 
              ('Cash Account', 'Cash', 0, :businessId, :outletId, NOW(), NOW()),
              ('Bank Account', 'Bank', 0, :businessId, :outletId, NOW(), NOW())
          `, {
            replacements: { businessId: business_id, outletId: outlet_id }
          });
          
          console.log('✅ Default accounts inserted successfully');
        } else {
          console.log('⚠️  No existing tenants found, skipping default account insertion');
        }
      } else {
        console.log('✅ Default accounts already exist');
      }
    } catch (error) {
      console.log('⚠️  Default accounts check failed:', error.message);
    }
    
    console.log('\n🎉 Accounting tables creation completed successfully!');
    console.log('📝 Accounting tables are now ready for use');
    
  } catch (error) {
    console.error('❌ Table creation failed:', error);
    process.exit(1);
  }
}

// Run the table creation
createAccountingTables();
