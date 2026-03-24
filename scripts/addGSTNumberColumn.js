require('dotenv').config();
const { sequelize } = require('../config/database_postgres');

async function addGSTNumberColumn() {
  try {
    console.log('🔧 Adding GST Number Column to Brands Table...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established.');
    
    // Add GST number column
    console.log('📝 Adding gst_number column to brands table...');
    await sequelize.query(`
      ALTER TABLE brands ADD COLUMN IF NOT EXISTS gst_number VARCHAR(20)
    `);
    console.log('✅ gst_number column added successfully');
    
    // Add index
    console.log('📝 Adding index for gst_number...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_brands_gst_number ON brands(gst_number)
    `);
    console.log('✅ Index added successfully');
    
    // Verify column exists
    console.log('🔍 Verifying column exists...');
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'brands' AND column_name = 'gst_number'
    `);
    
    if (columns.length > 0) {
      console.log('✅ gst_number column verified:');
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
      });
    } else {
      console.log('❌ gst_number column not found');
    }
    
    // Test update with GST number
    console.log('\n📝 Testing GST number update...');
    await sequelize.query(`
      UPDATE brands 
      SET gst_number = 'TEST1234567890AB' 
      WHERE gst_number IS NULL
    `);
    console.log('✅ GST number update test successful');
    
    console.log('\n🎉 GST Number Column Addition Completed Successfully!');
    console.log('📝 The brands table now supports GST number storage');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the migration
addGSTNumberColumn();
