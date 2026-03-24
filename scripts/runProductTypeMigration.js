require('dotenv').config();
const { sequelize } = require('../config/database_postgres');

async function runProductTypeMigration() {
  try {
    console.log('Starting migration: Add product type columns...');
    
    // Check if connection is established
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Add new columns to product_types table
    console.log('Adding columns to product_types table...');
    await sequelize.query(`
      ALTER TABLE product_types 
      ADD COLUMN IF NOT EXISTS description VARCHAR(255),
      ADD COLUMN IF NOT EXISTS icon VARCHAR(10) DEFAULT '🥬',
      ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#10B981'
    `);

    // Update existing records with default values if needed
    console.log('Updating existing records...');
    await sequelize.query(`
      UPDATE product_types SET icon = '🥬' WHERE icon IS NULL;
      UPDATE product_types SET color = '#10B981' WHERE color IS NULL
    `);

    console.log('✅ Product type migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

runProductTypeMigration();
