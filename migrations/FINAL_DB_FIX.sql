-- ========================================
-- FINAL DATABASE FIX FOR TENANT AVAILABILITY
-- ========================================

-- STEP 1: Ensure all critical columns exist in all tables
DO $$
BEGIN
    -- businesses table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'brand_id'
    ) THEN
        ALTER TABLE businesses ADD COLUMN brand_id UUID;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'business_id'
    ) THEN
        ALTER TABLE businesses ADD COLUMN business_id UUID;
    END IF;
    
    -- users table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'brand_id'
    ) THEN
        ALTER TABLE users ADD COLUMN brand_id UUID;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'business_id'
    ) THEN
        ALTER TABLE users ADD COLUMN business_id UUID;
    END IF;
    
    -- outlets table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'outlets' AND column_name = 'brand_id'
    ) THEN
        ALTER TABLE outlets ADD COLUMN brand_id UUID;
    END IF;
    
    -- products table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'brand_id'
    ) THEN
        ALTER TABLE products ADD COLUMN brand_id UUID;
    END IF;
    
    -- categories table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categories' AND column_name = 'brand_id'
    ) THEN
        ALTER TABLE categories ADD COLUMN brand_id UUID;
    END IF;
    
    -- orders table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'brand_id'
    ) THEN
        ALTER TABLE orders ADD COLUMN brand_id UUID;
    END IF;
    
END $$;

-- STEP 2: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_businesses_brand_id ON businesses(brand_id);
CREATE INDEX IF NOT EXISTS idx_businesses_business_id ON businesses(business_id);
CREATE INDEX IF NOT EXISTS idx_users_brand_id ON users(brand_id);
CREATE INDEX IF NOT EXISTS idx_users_business_id ON users(business_id);
CREATE INDEX IF NOT EXISTS idx_outlets_brand_id ON outlets(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_categories_brand_id ON categories(brand_id);
CREATE INDEX IF NOT EXISTS idx_orders_brand_id ON orders(brand_id);

-- STEP 3: Update statistics
ANALYZE businesses;
ANALYZE users;
ANALYZE outlets;
ANALYZE products;
ANALYZE categories;
ANALYZE orders;
