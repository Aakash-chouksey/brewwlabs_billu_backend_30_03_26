const { sequelize } = require('../config/database_postgres');
const { QueryTypes } = require('sequelize');

async function migrate() {
  console.log('🚀 Starting Database Migration for Multi-Tenancy...');
  
  const tables = [
    'categories',
    'products',
    'areas', 
    'tables',
    'inventory',
    'orders',
    'order_items',
    'payments',
    'purchases',
    'expenses',
    'users',
    'billing_configs',
    'timings'
  ];

  try {
    for (const table of tables) {
      console.log(`Checking table: ${table}`);
      
      const brandIdExists = await sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' AND column_name = 'brand_id'`,
        { type: QueryTypes.SELECT }
      );
      
      if (brandIdExists.length === 0) {
        console.log(`Adding brand_id to ${table}...`);
        await sequelize.query(`ALTER TABLE "${table}" ADD COLUMN brand_id UUID`);
        await sequelize.query(`CREATE INDEX idx_${table}_brand_id ON "${table}" (brand_id)`);
      }

      const outletIdExists = await sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' AND column_name = 'outlet_id'`,
        { type: QueryTypes.SELECT }
      );
      
      if (outletIdExists.length === 0) {
        console.log(`Adding outlet_id to ${table}...`);
        await sequelize.query(`ALTER TABLE "${table}" ADD COLUMN outlet_id UUID`);
        await sequelize.query(`CREATE INDEX idx_${table}_outlet_id ON "${table}" (outlet_id)`);
      }
    }

    const outletBrandExists = await sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'outlets' AND column_name = 'brand_id'`,
      { type: QueryTypes.SELECT }
    );
    if (outletBrandExists.length === 0) {
      console.log(`Adding brand_id to outlets...`);
      await sequelize.query(`ALTER TABLE "outlets" ADD COLUMN brand_id UUID`);
      await sequelize.query(`CREATE INDEX idx_outlets_brand_id ON "outlets" (brand_id)`);
    }

    console.log('✅ Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
