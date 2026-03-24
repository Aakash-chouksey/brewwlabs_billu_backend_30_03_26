-- Migration 003: Fix Tenant Database Product + Category Scope
-- Add outletId to categories and products for outlet-specific menus

-- Step 1: Add outletId column to categories table
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS outletId UUID REFERENCES outlets(id);

-- Step 2: Add outletId column to products table  
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS outletId UUID REFERENCES outlets(id);

-- Step 3: Create indexes for outlet-scoped queries
CREATE INDEX IF NOT EXISTS idx_categories_outlet ON categories(outletId);
CREATE INDEX IF NOT EXISTS idx_categories_business_outlet ON categories(businessId, outletId);
CREATE INDEX IF NOT EXISTS idx_categories_business_outlet_enabled ON categories(businessId, outletId, isEnabled);

CREATE INDEX IF NOT EXISTS idx_products_outlet ON products(outletId);
CREATE INDEX IF NOT EXISTS idx_products_business_outlet ON products(businessId, outletId);
CREATE INDEX IF NOT EXISTS idx_products_business_outlet_category ON products(businessId, outletId, categoryId);
CREATE INDEX IF NOT EXISTS idx_products_business_outlet_available ON products(businessId, outletId, isAvailable);

-- Step 4: Backfill outletId for existing data
-- For categories: Set to first outlet of the business if outletId is NULL
UPDATE categories 
SET outletId = (
    SELECT id 
    FROM outlets 
    WHERE businessId = categories.businessId 
    LIMIT 1
)
WHERE outletId IS NULL;

-- For products: Set to first outlet of the business if outletId is NULL
UPDATE products 
SET outletId = (
    SELECT id 
    FROM outlets 
    WHERE businessId = products.businessId 
    LIMIT 1
)
WHERE outletId IS NULL;

-- Step 5: Add constraints (optional - can be added after data validation)
-- ALTER TABLE categories 
-- ADD CONSTRAINT categories_business_outlet_not_null 
-- CHECK (businessId IS NOT NULL);

-- ALTER TABLE products 
-- ADD CONSTRAINT products_business_outlet_not_null 
-- CHECK (businessId IS NOT NULL);

-- Step 6: Update foreign key constraints to include outletId
-- Ensure categories belong to their business and outlet
ALTER TABLE categories 
ADD CONSTRAINT IF NOT EXISTS categories_business_fkey 
FOREIGN KEY (businessId) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE categories 
ADD CONSTRAINT IF NOT EXISTS categories_outlet_fkey 
FOREIGN KEY (outletId) REFERENCES outlets(id) ON DELETE CASCADE;

-- Ensure products belong to their business and outlet
ALTER TABLE products 
ADD CONSTRAINT IF NOT EXISTS products_business_fkey 
FOREIGN KEY (businessId) REFERENCES businesses(id) ON DELETE CASCADE;

ALTER TABLE products 
ADD CONSTRAINT IF NOT EXISTS products_outlet_fkey 
FOREIGN KEY (outletId) REFERENCES outlets(id) ON DELETE CASCADE;

-- Step 7: Add comments for documentation
COMMENT ON COLUMN categories.outletId IS 'Outlet ID for outlet-specific menu categories';
COMMENT ON COLUMN products.outletId IS 'Outlet ID for outlet-specific product availability and pricing';

COMMIT;
