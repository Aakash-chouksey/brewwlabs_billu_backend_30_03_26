-- ========================================
-- SIMPLE MULTI-TENANT SYSTEM FIX
-- ========================================

-- STEP 1: Add brand_id to businesses table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'brand_id'
    ) THEN
        ALTER TABLE businesses ADD COLUMN brand_id UUID;
    END IF;
END $$;

-- STEP 2: Add basic indexes
CREATE INDEX IF NOT EXISTS idx_businesses_brand_id ON businesses(brand_id);
CREATE INDEX IF NOT EXISTS idx_users_brand_role ON users(brand_id, role);
CREATE INDEX IF NOT EXISTS idx_users_brand_active ON users(brand_id, is_active);
CREATE INDEX IF NOT EXISTS idx_orders_brand_outlet_created ON orders(brand_id, outlet_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_brand_number ON orders(brand_id, order_number);
CREATE INDEX IF NOT EXISTS idx_products_brand_category_available ON products(brand_id, category_id, is_available);
CREATE INDEX IF NOT EXISTS idx_categories_brand_outlet ON categories(brand_id, outlet_id);

-- STEP 3: Update data consistency
UPDATE businesses 
SET brand_id = brands.id 
FROM brands 
WHERE brands.business_id = businesses.id 
AND businesses.brand_id IS NULL;

-- STEP 4: Update table statistics
ANALYZE businesses;
ANALYZE users;
ANALYZE orders;
ANALYZE products;
ANALYZE categories;
