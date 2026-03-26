require('dotenv').config();
const { Sequelize } = require('sequelize');

const tenantSequelize = new Sequelize(process.env.DATABASE_URL, {
  logging: false
});

async function addMissingColumns() {
  try {
    console.log('🔧 Adding missing columns to tables...');
    
    await tenantSequelize.authenticate();
    console.log('✅ Connected to database');
    
    // Add missing columns to orders table
    console.log('📝 Adding columns to orders table...');
    
    await tenantSequelize.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS customer_details JSONB NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS billing_sub_total DECIMAL(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS billing_tax DECIMAL(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS billing_discount DECIMAL(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS billing_total DECIMAL(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS order_status VARCHAR(50) DEFAULT 'CREATED',
      ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'Pending',
      ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'Pending',
      ADD COLUMN IF NOT EXISTS payment_razorpay_order_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS payment_razorpay_payment_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS payment_paid_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255) UNIQUE,
      ADD COLUMN IF NOT EXISTS waiter_id UUID,
      ADD COLUMN IF NOT EXISTS customer_id UUID
    `);
    
    console.log('✅ Orders table updated');
    
    // Add missing columns to products table
    console.log('📝 Adding columns to products table...');
    
    await tenantSequelize.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS product_type_id UUID,
      ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS track_stock BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS recipe JSONB DEFAULT '[]'
    `);
    
    console.log('✅ Products table updated');
    
    // Add missing columns to categories table
    console.log('📝 Adding columns to categories table...');
    
    await tenantSequelize.query(`
      ALTER TABLE categories 
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true
    `);
    
    console.log('✅ Categories table updated');
    
    // Add missing columns to tables table
    console.log('📝 Adding columns to tables table...');
    
    await tenantSequelize.query(`
      ALTER TABLE tables 
      ADD COLUMN IF NOT EXISTS business_id UUID NOT NULL DEFAULT '1265c615-c0c1-4f0f-8b66-68b0d072891f',
      ADD COLUMN IF NOT EXISTS outlet_id UUID NOT NULL DEFAULT '1265c615-c0c1-4f0f-8b66-68b0d072891f',
      ADD COLUMN IF NOT EXISTS name VARCHAR(255) NOT NULL DEFAULT 'Table 1',
      ADD COLUMN IF NOT EXISTS table_no VARCHAR(50),
      ADD COLUMN IF NOT EXISTS area_id UUID,
      ADD COLUMN IF NOT EXISTS current_order_id UUID,
      ADD COLUMN IF NOT EXISTS shape VARCHAR(50) DEFAULT 'square',
      ADD COLUMN IF NOT EXISTS current_occupancy INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS qr_code VARCHAR(255)
    `);
    
    console.log('✅ Tables table updated');
    
    console.log('✅ All missing columns added successfully');
    await tenantSequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await tenantSequelize.close();
  }
}

addMissingColumns();
