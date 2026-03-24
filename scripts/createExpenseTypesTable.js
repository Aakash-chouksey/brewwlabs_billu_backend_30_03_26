require('dotenv').config();
const { sequelize } = require('../config/database_postgres');

async function createExpenseTypesTable() {
  try {
    console.log('🔧 Creating Expense Types Table...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established.');
    
    // Create expense_types table
    console.log('📝 Creating expense_types table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS expense_types (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          brand_id UUID NOT NULL,
          outlet_id UUID NOT NULL,
          name VARCHAR(255) NOT NULL,
          description VARCHAR(500),
          is_enabled BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ expense_types table created successfully');
    
    // Create indexes
    console.log('📝 Creating indexes...');
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_expense_types_brand_outlet ON expense_types(brand_id, outlet_id)`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_expense_types_name ON expense_types(name)`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_expense_types_enabled ON expense_types(is_enabled)`);
    console.log('✅ Indexes created');
    
    // Add foreign key constraints if the referenced tables exist
    console.log('📝 Adding foreign key constraints...');
    try {
      await sequelize.query(`
        ALTER TABLE expense_types ADD CONSTRAINT fk_expense_types_brand 
        FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
      `);
      console.log('✅ Brand foreign key added');
    } catch (error) {
      console.log('⚠️  Brand foreign key failed (brands table may not exist):', error.message);
    }
    
    try {
      await sequelize.query(`
        ALTER TABLE expense_types ADD CONSTRAINT fk_expense_types_outlet 
        FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE CASCADE
      `);
      console.log('✅ Outlet foreign key added');
    } catch (error) {
      console.log('⚠️  Outlet foreign key failed (outlets table may not exist):', error.message);
    }
    
    // Add update timestamp trigger
    console.log('📝 Creating update trigger...');
    await sequelize.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);
    
    await sequelize.query(`
      CREATE TRIGGER update_expense_types_updated_at 
      BEFORE UPDATE ON expense_types 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `);
    console.log('✅ Update trigger created');
    
    // Verify table exists
    console.log('🔍 Verifying table...');
    const [tableCheck] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'expense_types'
    `);
    
    console.log(`📊 expense_types table exists: ${tableCheck[0].count > 0 ? 'YES' : 'NO'}`);
    
    // Show table structure
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
    }
    
    // Insert default expense types if they don't exist
    console.log('\n📝 Checking for default expense types...');
    try {
      const [defaultCheck] = await sequelize.query(`
        SELECT COUNT(*) as count FROM expense_types 
        WHERE name IN ('Utilities', 'Rent', 'Supplies')
      `);
      
      if (defaultCheck[0].count === 0) {
        console.log('📝 Inserting default expense types...');
        
        // Get a sample brand and outlet for default expense types
        const [sampleTenant] = await sequelize.query(`
          SELECT brand_id, outlet_id 
          FROM outlets 
          LIMIT 1
        `);
        
        if (sampleTenant.length > 0) {
          const { brand_id, outlet_id } = sampleTenant[0];
          
          await sequelize.query(`
            INSERT INTO expense_types (brand_id, outlet_id, name, description, created_at, updated_at)
            VALUES 
              (:brand_id, :outlet_id, 'Utilities', 'Electricity, water, internet, and other utility expenses', NOW(), NOW()),
              (:brand_id, :outlet_id, 'Rent', 'Monthly rent and lease payments', NOW(), NOW()),
              (:brand_id, :outlet_id, 'Supplies', 'Office supplies, materials, and equipment', NOW(), NOW())
          `, {
            replacements: { brand_id, outlet_id }
          });
          
          console.log('✅ Default expense types inserted successfully');
        } else {
          console.log('⚠️  No existing tenants found, skipping default expense types insertion');
        }
      } else {
        console.log('✅ Default expense types already exist');
      }
    } catch (error) {
      console.log('⚠️  Default expense types check failed:', error.message);
    }
    
    console.log('\n🎉 Expense types table creation completed successfully!');
    console.log('📝 Expense types table is now ready for use');
    
  } catch (error) {
    console.error('❌ Table creation failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the table creation
createExpenseTypesTable();
