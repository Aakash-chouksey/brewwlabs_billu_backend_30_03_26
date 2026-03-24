require('dotenv').config();
const { sequelize } = require('../config/database_postgres');

async function checkAndFixSchema() {
    try {
        console.log('🔍 Checking database schema...');
        
        // Check if customer_id column exists in orders table
        const [results] = await sequelize.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'orders' 
            AND column_name = 'customer_id'
        `);
        
        console.log('📋 customer_id column check:', results);
        
        if (results.length === 0) {
            console.log('❌ customer_id column missing, adding it...');
            
            // Add customer_id column to orders table
            await sequelize.query(`
                ALTER TABLE orders 
                ADD COLUMN IF NOT EXISTS customer_id UUID,
                ADD COLUMN IF NOT EXISTS waiter_id UUID
            `);
            
            console.log('✅ Added missing columns to orders table');
        }
        
        // Check customers table exists
        const [customerTable] = await sequelize.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'customers'
            ) as exists
        `);
        
        console.log('📋 customers table check:', customerTable);
        
        if (!customerTable[0].exists) {
            console.log('❌ customers table missing, creating it...');
            
            await sequelize.query(`
                CREATE TABLE IF NOT EXISTS customers (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    brand_id UUID NOT NULL,
                    outlet_id UUID NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    phone VARCHAR(15) NOT NULL,
                    email VARCHAR(255),
                    address TEXT,
                    total_due DECIMAL(10,2) DEFAULT 0.00,
                    total_paid DECIMAL(10,2) DEFAULT 0.00,
                    last_visit_at TIMESTAMP,
                    visit_count INTEGER DEFAULT 0,
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_customers_brand_id ON customers(brand_id);
                CREATE INDEX IF NOT EXISTS idx_customers_brand_outlet ON customers(brand_id, outlet_id);
                CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_brand_outlet_phone ON customers(brand_id, outlet_id, phone);
            `);
            
            console.log('✅ Created customers table');
        }
        
        console.log('🎉 Database schema check completed!');
        
    } catch (error) {
        console.error('❌ Schema check failed:', error);
    } finally {
        await sequelize.close();
    }
}

checkAndFixSchema();
