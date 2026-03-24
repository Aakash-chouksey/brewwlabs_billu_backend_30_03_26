-- TENANT SCHEMA FIX: ADD business_id TO ALL TABLES
-- This script ensures all tenant-specific tables have a business_id column for isolation.

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Add business_id to core tables
-- USERS
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='business_id') THEN
        ALTER TABLE users ADD COLUMN business_id uuid;
    END IF;
END $$;

-- OUTLETS
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='outlets' AND column_name='business_id') THEN
        ALTER TABLE outlets ADD COLUMN business_id uuid;
    END IF;
END $$;

-- PRODUCTS
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='business_id') THEN
        ALTER TABLE products ADD COLUMN business_id uuid;
    END IF;
END $$;

-- CATEGORIES
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='business_id') THEN
        ALTER TABLE categories ADD COLUMN business_id uuid;
    END IF;
END $$;

-- ORDERS
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='business_id') THEN
        ALTER TABLE orders ADD COLUMN business_id uuid;
    END IF;
END $$;

-- ORDER_ITEMS
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_items' AND column_name='business_id') THEN
        ALTER TABLE order_items ADD COLUMN business_id uuid;
    END IF;
END $$;

-- INVENTORY (inventory_items)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_items' AND column_name='business_id') THEN
        ALTER TABLE inventory_items ADD COLUMN business_id uuid;
    END IF;
END $$;

-- INVENTORY_TRANSACTIONS
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_transactions' AND column_name='business_id') THEN
        ALTER TABLE inventory_transactions ADD COLUMN business_id uuid;
    END IF;
END $$;

-- BILLING_CONFIGS
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='billing_configs' AND column_name='business_id') THEN
        ALTER TABLE billing_configs ADD COLUMN business_id uuid;
    END IF;
END $$;

-- CUSTOMERS
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='business_id') THEN
        ALTER TABLE customers ADD COLUMN business_id uuid;
    END IF;
END $$;

-- 3. BACKFILL business_id (Logic depends on your schema structure)
-- Assuming we have a 'businesses' table or we can get business_id from related tables.
-- If businesses table exists, we can use it to link.

-- Example: Link users to a business if they are the first user of that business
-- This part is tricky without knowing the exact state of your data.
-- Standard approach: DEFAULT to a known business ID or use a placeholder then fix manually.

-- 4. SET NOT NULL and Add Indexes
DO $$ 
BEGIN 
    -- USERS
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='business_id') THEN
        -- ALTER TABLE users ALTER COLUMN business_id SET NOT NULL; -- ONLY AFTER BACKFILL
        CREATE INDEX IF NOT EXISTS idx_users_business ON users(business_id);
    END IF;

    -- OUTLETS
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='outlets' AND column_name='business_id') THEN
        CREATE INDEX IF NOT EXISTS idx_outlets_business ON outlets(business_id);
    END IF;

    -- PRODUCTS
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='business_id') THEN
        CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);
    END IF;

    -- CATEGORIES
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='business_id') THEN
        CREATE INDEX IF NOT EXISTS idx_categories_business ON categories(business_id);
    END IF;

    -- ORDERS
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='business_id') THEN
        CREATE INDEX IF NOT EXISTS idx_orders_business ON orders(business_id);
    END IF;
    
    -- INVENTORY
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_items' AND column_name='business_id') THEN
        CREATE INDEX IF NOT EXISTS idx_inventory_business ON inventory_items(business_id);
    END IF;
END $$;
