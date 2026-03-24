require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function runAccountingMigration() {
  try {
    console.log('🔧 Starting Accounting Tables Migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/014_create_accounting_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Migration file loaded successfully');
    
    // Import database connection
    const { sequelize } = require('../config/database_postgres');
    
    // Check if connection is established
    await sequelize.authenticate();
    console.log('✅ Database connection established.');
    
    // Execute the migration
    console.log('🚀 Creating accounting tables...');
    await sequelize.query(migrationSQL);
    
    console.log('✅ Accounting tables migration completed successfully!');
    
    // Verify tables were created
    console.log('🔍 Verifying tables were created...');
    
    const [accountsResult] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'Accounts'
    `);
    
    const [transactionsResult] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'Transactions'
    `);
    
    console.log(`📊 Accounts table exists: ${accountsResult[0].count > 0 ? 'YES' : 'NO'}`);
    console.log(`📊 Transactions table exists: ${transactionsResult[0].count > 0 ? 'YES' : 'NO'}`);
    
    // Show table structures
    if (accountsResult[0].count > 0) {
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
    
    if (transactionsResult[0].count > 0) {
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
    
    // Insert default accounts if they don't exist
    console.log('\n🔧 Checking for default accounts...');
    
    const [defaultAccountsCheck] = await sequelize.query(`
      SELECT COUNT(*) as count FROM "Accounts" 
      WHERE name IN ('Cash Account', 'Bank Account')
      LIMIT 1
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
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('📝 Accounting tables are now ready for use');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the migration
runAccountingMigration();
