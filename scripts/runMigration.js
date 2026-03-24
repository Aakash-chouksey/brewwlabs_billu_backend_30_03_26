require('dotenv').config();
const { sequelize } = require('../config/database_postgres');

async function runMigration() {
  try {
    console.log('Starting migration: Add table and area columns...');
    
    // Check if connection is established
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Add new columns to tables table
    console.log('Adding columns to tables table...');
    await sequelize.query(`
      ALTER TABLE tables 
      ADD COLUMN IF NOT EXISTS table_no VARCHAR(50),
      ADD COLUMN IF NOT EXISTS shape VARCHAR(20) DEFAULT 'square' CHECK (shape IN ('square', 'round', 'rectangular')),
      ADD COLUMN IF NOT EXISTS current_occupancy INTEGER DEFAULT 0
    `);

    // Add new columns to table_areas table  
    console.log('Adding columns to table_areas table...');
    await sequelize.query(`
      ALTER TABLE table_areas
      ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 20,
      ADD COLUMN IF NOT EXISTS layout VARCHAR(20) DEFAULT 'square' CHECK (layout IN ('square', 'rectangular', 'circular', 'linear')),
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive'))
    `);

    // Add indexes for better performance
    console.log('Adding indexes...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_tables_table_no ON tables(table_no);
      CREATE INDEX IF NOT EXISTS idx_tables_shape ON tables(shape);
      CREATE INDEX IF NOT EXISTS idx_table_areas_layout ON table_areas(layout);
      CREATE INDEX IF NOT EXISTS idx_table_areas_status ON table_areas(status)
    `);

    // Update existing records with default values if needed
    console.log('Updating existing records...');
    await sequelize.query(`
      UPDATE tables SET shape = 'square' WHERE shape IS NULL;
      UPDATE tables SET current_occupancy = 0 WHERE current_occupancy IS NULL;
      UPDATE table_areas SET capacity = 20 WHERE capacity IS NULL;
      UPDATE table_areas SET layout = 'square' WHERE layout IS NULL;
      UPDATE table_areas SET status = 'active' WHERE status IS NULL
    `);

    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

runMigration();
