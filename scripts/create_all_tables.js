#!/usr/bin/env node

/**
 * CREATE ALL DATABASE TABLES
 * This script creates all tables required by the models with proper schema
 */

require('dotenv').config();
const { Client } = require('pg');

async function createAllTables() {
    console.log('🏗️ Creating all database tables...');
    
    const client = new Client({
        user: 'brewlabs_user',
        password: 'securepass',
        host: 'localhost',
        port: 5432,
        database: 'brewlabs_dev'
    });
    
    try {
        await client.connect();
        console.log('✅ Connected to database');
        
        // Create all tables with proper schema
        const tables = [
            // Accounts table
            `CREATE TABLE IF NOT EXISTS accounts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                type VARCHAR(20) DEFAULT 'Cash' CHECK (type IN ('Cash', 'Bank', 'Digital', 'Other')),
                balance DECIMAL(15,2) DEFAULT 0.00,
                business_id UUID NOT NULL,
                outlet_id UUID,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )`,
            
            // Transactions table
            `CREATE TABLE IF NOT EXISTS transactions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                type VARCHAR(20) NOT NULL CHECK (type IN ('credit', 'debit')),
                amount DECIMAL(15,2) NOT NULL,
                description TEXT,
                category VARCHAR(100),
                date DATE NOT NULL,
                account_id UUID REFERENCES accounts(id),
                business_id UUID NOT NULL,
                outlet_id UUID,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )`,
            
            // Categories table
            `CREATE TABLE IF NOT EXISTS categories (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                business_id UUID NOT NULL,
                outlet_id UUID,
                parent_id UUID REFERENCES categories(id),
                image_url VARCHAR(500),
                is_active BOOLEAN DEFAULT true,
                display_order INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )`,
            
            // Products table
            `CREATE TABLE IF NOT EXISTS products (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                price DECIMAL(10,2) NOT NULL,
                cost_price DECIMAL(10,2),
                sku VARCHAR(100),
                barcode VARCHAR(100),
                image_url VARCHAR(500),
                category_id UUID REFERENCES categories(id),
                product_type_id UUID REFERENCES product_types(id),
                business_id UUID NOT NULL,
                outlet_id UUID,
                is_active BOOLEAN DEFAULT true,
                track_inventory BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )`,
            
            // Orders table
            `CREATE TABLE IF NOT EXISTS orders (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                order_number VARCHAR(50) UNIQUE,
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')),
                total_amount DECIMAL(10,2) NOT NULL,
                tax_amount DECIMAL(10,2) DEFAULT 0.00,
                discount_amount DECIMAL(10,2) DEFAULT 0.00,
                customer_id UUID,
                business_id UUID NOT NULL,
                outlet_id UUID NOT NULL,
                table_id UUID,
                staff_id UUID,
                order_type VARCHAR(20) DEFAULT 'dine_in' CHECK (order_type IN ('dine_in', 'takeaway', 'delivery')),
                payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )`,
            
            // Order items table
            `CREATE TABLE IF NOT EXISTS order_items (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                product_id UUID NOT NULL REFERENCES products(id),
                quantity INTEGER NOT NULL,
                unit_price DECIMAL(10,2) NOT NULL,
                total_price DECIMAL(10,2) NOT NULL,
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )`,
            
            // Customers table
            `CREATE TABLE IF NOT EXISTS customers (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                email VARCHAR(255),
                address TEXT,
                business_id UUID NOT NULL,
                outlet_id UUID NOT NULL,
                loyalty_points INTEGER DEFAULT 0,
                total_orders INTEGER DEFAULT 0,
                total_spent DECIMAL(15,2) DEFAULT 0.00,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )`,
            
            // Inventory items table
            `CREATE TABLE IF NOT EXISTS inventory_items (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                sku VARCHAR(100),
                category VARCHAR(100),
                unit VARCHAR(50),
                current_stock DECIMAL(10,2) DEFAULT 0.00,
                min_stock_level DECIMAL(10,2) DEFAULT 0.00,
                max_stock_level DECIMAL(10,2),
                cost_price DECIMAL(10,2),
                selling_price DECIMAL(10,2),
                business_id UUID NOT NULL,
                outlet_id UUID NOT NULL,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )`,
            
            // Inventory transactions table
            `CREATE TABLE IF NOT EXISTS inventory_transactions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
                transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('PURCHASE', 'SALE', 'SELF_CONSUME', 'WASTAGE', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT')),
                quantity DECIMAL(10,2) NOT NULL,
                unit_cost DECIMAL(10,2),
                reference_id UUID,
                reference_type VARCHAR(50),
                notes TEXT,
                business_id UUID NOT NULL,
                outlet_id UUID NOT NULL,
                created_by UUID,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )`
        ];
        
        // Create each table
        for (let i = 0; i < tables.length; i++) {
            console.log(`📝 Creating table ${i + 1}/${tables.length}...`);
            await client.query(tables[i]);
        }
        
        // Create indexes for performance
        console.log('🔧 Creating indexes...');
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_accounts_business_id ON accounts(business_id)',
            'CREATE INDEX IF NOT EXISTS idx_accounts_outlet_id ON accounts(outlet_id)',
            'CREATE INDEX IF NOT EXISTS idx_transactions_business_id ON transactions(business_id)',
            'CREATE INDEX IF NOT EXISTS idx_transactions_outlet_id ON transactions(outlet_id)',
            'CREATE INDEX IF NOT EXISTS idx_categories_business_id ON categories(business_id)',
            'CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id)',
            'CREATE INDEX IF NOT EXISTS idx_orders_business_id ON orders(business_id)',
            'CREATE INDEX IF NOT EXISTS idx_orders_outlet_id ON orders(outlet_id)',
            'CREATE INDEX IF NOT EXISTS idx_customers_business_id ON customers(business_id)',
            'CREATE INDEX IF NOT EXISTS idx_inventory_items_business_id ON inventory_items(business_id)'
        ];
        
        for (const index of indexes) {
            await client.query(index);
        }
        
        console.log('✅ All tables created successfully');
        
        // Verify tables were created
        const result = await client.query(
            'SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name',
            ['public']
        );
        
        console.log('📊 Available tables:');
        result.rows.forEach(row => {
            console.log('  ' + row.table_name);
        });
        
    } catch (error) {
        console.error('❌ Table creation failed:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

createAllTables();
