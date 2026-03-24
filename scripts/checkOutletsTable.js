require('dotenv').config();
const { sequelize } = require('../config/database_postgres');

async function checkOutletsTable() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established.');
    
    // Check if outlets table exists
    const [tableCheck] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'outlets'
    `);
    
    console.log(`📊 Outlets table exists: ${tableCheck[0].count > 0 ? 'YES' : 'NO'}`);
    
    if (tableCheck[0].count > 0) {
      // Get table structure
      const [columns] = await sequelize.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'outlets'
        ORDER BY ordinal_position
      `);
      
      console.log('\n📋 Outlets table structure:');
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable}) ${col.column_default || ''}`);
      });
      
      // Get sample data
      const [sampleData] = await sequelize.query('SELECT * FROM outlets LIMIT 3');
      
      if (sampleData.length > 0) {
        console.log('\n📝 Sample outlets data:');
        sampleData.forEach(outlet => {
          console.log(`  - ID: ${outlet.id}, Name: ${outlet.name || 'No name'}`);
        });
      } else {
        console.log('\n⚠️  No outlets found in table');
      }
    }
    
    // Also check brands table
    const [brandTableCheck] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'brands'
    `);
    
    console.log(`\n📊 Brands table exists: ${brandTableCheck[0].count > 0 ? 'YES' : 'NO'}`);
    
    if (brandTableCheck[0].count > 0) {
      const [brandColumns] = await sequelize.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'brands'
        ORDER BY ordinal_position
      `);
      
      console.log('\n📋 Brands table structure:');
      brandColumns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable}) ${col.column_default || ''}`);
      });
      
      const [brandSample] = await sequelize.query('SELECT * FROM brands LIMIT 3');
      
      if (brandSample.length > 0) {
        console.log('\n📝 Sample brands data:');
        brandSample.forEach(brand => {
          console.log(`  - ID: ${brand.id}, Name: ${brand.name || 'No name'}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sequelize.close();
  }
}

checkOutletsTable();
