-- ========================================
-- COMPLETE MULTI-TENANT SYSTEM FIX
-- ========================================
-- This migration fixes ALL identified issues:
-- 1. Missing brand_id in businesses table
-- 2. Missing foreign key constraints
-- 3. Missing performance indexes
-- 4. Data consistency fixes
-- ========================================

-- ========================================
-- STEP 1: FIX CRITICAL BUSINESS MODEL ISSUE
-- ========================================

-- Add brand_id to businesses table if it doesn't exist
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS brand_id UUID;

-- Add brand_id index to businesses table for performance
CREATE INDEX IF NOT EXISTS idx_businesses_brand_id ON businesses(brand_id);

-- Create unique constraint on businesses.brand_id (one business per brand)
ALTER TABLE businesses ADD CONSTRAINT IF NOT EXISTS businesses_brand_id_unique UNIQUE (brand_id);

-- ========================================
-- STEP 2: ADD MISSING FOREIGN KEY CONSTRAINTS
-- ========================================

-- tenant_connections.brand_id → brands.id
ALTER TABLE tenant_connections 
ADD CONSTRAINT IF NOT EXISTS fk_tenant_connections_brand_id 
FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;

-- users.brand_id → brands.id
ALTER TABLE users 
ADD CONSTRAINT IF NOT EXISTS fk_users_brand_id 
FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;

-- users.outlet_id → outlets.id
ALTER TABLE users 
ADD CONSTRAINT IF NOT EXISTS fk_users_outlet_id 
FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE SET NULL;

-- outlets.brand_id → brands.id
ALTER TABLE outlets 
ADD CONSTRAINT IF NOT EXISTS fk_outlets_brand_id 
FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;

-- products.brand_id → brands.id
ALTER TABLE products 
ADD CONSTRAINT IF NOT EXISTS fk_products_brand_id 
FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;

-- products.category_id → categories.id
ALTER TABLE products 
ADD CONSTRAINT IF NOT EXISTS fk_products_category_id 
FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

-- products.outlet_id → outlets.id
ALTER TABLE products 
ADD CONSTRAINT IF NOT EXISTS fk_products_outlet_id 
FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE SET NULL;

-- categories.brand_id → brands.id
ALTER TABLE categories 
ADD CONSTRAINT IF NOT EXISTS fk_categories_brand_id 
FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;

-- categories.outlet_id → outlets.id
ALTER TABLE categories 
ADD CONSTRAINT IF NOT EXISTS fk_categories_outlet_id 
FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE SET NULL;

-- orders.brand_id → brands.id
ALTER TABLE orders 
ADD CONSTRAINT IF NOT EXISTS fk_orders_brand_id 
FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;

-- orders.outlet_id → outlets.id
ALTER TABLE orders 
ADD CONSTRAINT IF NOT EXISTS fk_orders_outlet_id 
FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE CASCADE;

-- orders.waiter_id → users.id
ALTER TABLE orders 
ADD CONSTRAINT IF NOT EXISTS fk_orders_waiter_id 
FOREIGN KEY (waiter_id) REFERENCES users(id) ON DELETE SET NULL;

-- orders.customer_id → customers.id (if customers table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'customers'
    ) THEN
        ALTER TABLE orders 
        ADD CONSTRAINT IF NOT EXISTS fk_orders_customer_id 
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ========================================
-- STEP 3: ADD CRITICAL PERFORMANCE INDEXES
-- ========================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_brand_role ON users(brand_id, role);
CREATE INDEX IF NOT EXISTS idx_users_brand_active ON users(brand_id, is_active);

-- Orders table indexes (critical for performance)
CREATE INDEX IF NOT EXISTS idx_orders_brand_outlet_created ON orders(brand_id, outlet_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_brand_number ON orders(brand_id, order_number);
CREATE INDEX IF NOT EXISTS idx_orders_brand_status ON orders(brand_id, order_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- Products table indexes
CREATE INDEX IF NOT EXISTS idx_products_brand_category_available ON products(brand_id, category_id, is_available);
CREATE INDEX IF NOT EXISTS idx_products_brand_outlet ON products(brand_id, outlet_id);

-- Categories table indexes
CREATE INDEX IF NOT EXISTS idx_categories_brand_outlet ON categories(brand_id, outlet_id);
CREATE INDEX IF NOT EXISTS idx_categories_brand_enabled ON categories(brand_id, is_enabled);

-- Inventory table indexes (if exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_items'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_inventory_items_brand ON inventory_items(brand_id);
        CREATE INDEX IF NOT EXISTS idx_inventory_items_brand_name ON inventory_items(brand_id, item_name);
    END IF;
END $$;

-- ========================================
-- STEP 4: DATA CONSISTENCY FIXES
-- ========================================

-- Update businesses.brand_id from brands table for existing data
UPDATE businesses 
SET brand_id = brands.id 
FROM brands 
WHERE brands.business_id = businesses.id 
AND businesses.brand_id IS NULL;

-- ========================================
-- STEP 5: PERFORMANCE TUNING
-- ========================================

-- Update table statistics for query optimizer
ANALYZE businesses;
ANALYZE users;
ANALYZE outlets;
ANALYZE products;
ANALYZE categories;
ANALYZE orders;
ANALYZE brands;
ANALYZE tenant_connections;
