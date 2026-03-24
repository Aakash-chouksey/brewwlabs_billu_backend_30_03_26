-- ========================================
-- TENANT DATABASE SCHEMA FIXES
-- ========================================

-- 1. FIX USERS TABLE - Remove businessId confusion
-- ========================================

-- Add comment to clarify field usage
COMMENT ON COLUMN users.business_id IS 'DEPRECATED: Use brand_id for tenant isolation. This field causes confusion with control plane brands.';

-- Create constraint to ensure data consistency
ALTER TABLE users 
ADD CONSTRAINT IF NOT EXISTS check_brand_or_business_id 
  CHECK (business_id IS NULL OR business_id = brand_id);

-- 2. ENHANCE USERS TABLE WITH CRITICAL CONSTRAINTS
-- ========================================

-- Drop existing unique constraint on email if it exists
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_unique;

-- Add composite unique constraint (brand_id, email) for proper tenant isolation
ALTER TABLE users 
ADD CONSTRAINT IF NOT EXISTS users_brand_email_unique 
  UNIQUE (brand_id, email);

-- Add NOT NULL constraint for brand_id (critical for tenant isolation)
ALTER TABLE users 
ALTER COLUMN brand_id SET NOT NULL;

-- Add validation constraints
ALTER TABLE users 
ADD CONSTRAINT IF NOT EXISTS check_user_role 
  CHECK (role IN ('SuperAdmin', 'BusinessAdmin', 'SubAdmin', 'Manager', 'Cashier', 'Waiter')),
ADD CONSTRAINT IF NOT EXISTS check_panel_type 
  CHECK (panel_type IN ('ADMIN', 'TENANT'));

-- 3. ENHANCE OUTLETS TABLE
-- ========================================

-- Add NOT NULL constraint for brand_id
ALTER TABLE outlets 
ALTER COLUMN brand_id SET NOT NULL;

-- Add validation constraint
ALTER TABLE outlets 
ADD CONSTRAINT IF NOT EXISTS check_outlet_active 
  CHECK (is_active IS NOT NULL);

-- 4. ENHANCE PRODUCTS TABLE
-- ========================================

-- Fix duplicate unique constraints - keep only the correct ones
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_brand_id_outlet_id_name_unique;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_brand_id_category_id_name_unique;

-- Add proper unique constraint
ALTER TABLE products 
ADD CONSTRAINT IF NOT EXISTS products_brand_outlet_name_unique 
  UNIQUE (brand_id, outlet_id, name);

-- Add validation constraints
ALTER TABLE products 
ADD CONSTRAINT IF NOT EXISTS check_product_price 
  CHECK (price >= 0),
ADD CONSTRAINT IF NOT EXISTS check_product_stock 
  CHECK (stock >= 0);

-- 5. ENHANCE ORDERS TABLE
-- ========================================

-- Add validation constraints
ALTER TABLE orders 
ADD CONSTRAINT IF NOT EXISTS check_order_totals 
  CHECK (billing_sub_total >= 0 AND billing_tax >= 0 AND billing_total >= 0),
ADD CONSTRAINT IF NOT EXISTS check_billing_math 
  CHECK (billing_total = billing_sub_total + billing_tax - COALESCE(billing_discount, 0));

-- 6. ENHANCE CATEGORIES TABLE (if exists)
-- ========================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'categories') THEN
    ALTER TABLE categories 
    ALTER COLUMN brand_id SET NOT NULL;
    
    ALTER TABLE categories 
    ADD CONSTRAINT IF NOT EXISTS categories_brand_name_unique 
    UNIQUE (brand_id, name);
  END IF;
END $$;

-- 7. ADD PERFORMANCE INDEXES
-- ========================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_brand_role ON users(brand_id, role);
CREATE INDEX IF NOT EXISTS idx_users_brand_active ON users(brand_id, is_active);
CREATE INDEX IF NOT EXISTS idx_users_brand_outlet ON users(brand_id, outlet_id) WHERE outlet_id IS NOT NULL;

-- Orders table indexes
CREATE INDEX IF NOT EXISTS idx_orders_brand_created_at ON orders(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_brand_order_number ON orders(brand_id, order_number) WHERE order_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_brand_status ON orders(brand_id, order_status);

-- Products table indexes
CREATE INDEX IF NOT EXISTS idx_products_brand_available ON products(brand_id, is_available);
CREATE INDEX IF NOT EXISTS idx_products_brand_category ON products(brand_id, category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_brand_outlet_available ON products(brand_id, outlet_id, is_available);

-- Outlets table indexes
CREATE INDEX IF NOT EXISTS idx_outlets_brand_active ON outlets(brand_id, is_active);
CREATE INDEX IF NOT EXISTS idx_outlets_brand_created ON outlets(brand_id, created_at DESC);

-- 8. FOREIGN KEY CONSTRAINTS
-- ========================================

-- Ensure proper foreign key relationships
DO $$
BEGIN
  -- Users -> Outlets
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                  WHERE constraint_name = 'users_outlet_id_fkey') THEN
    ALTER TABLE users 
    ADD CONSTRAINT users_outlet_id_fkey 
    FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE SET NULL;
  END IF;
  
  -- Products -> Categories
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'categories') AND
     NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                  WHERE constraint_name = 'products_category_id_fkey') THEN
    ALTER TABLE products 
    ADD CONSTRAINT products_category_id_fkey 
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT;
  END IF;
  
  -- Orders -> Users (waiter)
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                  WHERE constraint_name = 'orders_waiter_id_fkey') THEN
    ALTER TABLE orders 
    ADD CONSTRAINT orders_waiter_id_fkey 
    FOREIGN KEY (waiter_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 9. TENANT ISOLATION VALIDATION FUNCTION
-- ========================================

-- Function to validate tenant isolation
CREATE OR REPLACE FUNCTION validate_tenant_isolation(table_name TEXT, record_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  brand_count INTEGER;
BEGIN
  EXECUTE format('SELECT COUNT(DISTINCT brand_id) FROM %s WHERE id = $1', table_name)
  INTO brand_count
  USING record_id;
  
  RETURN brand_count = 1;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 10. DATA CLEANUP FOR EXISTING RECORDS
-- ========================================

-- Fix users with NULL brand_id (critical issue)
UPDATE users 
SET brand_id = (
  SELECT COALESCE(business_id, (SELECT MIN(id) FROM brands LIMIT 1))
  FROM users u2 
  WHERE u2.id = users.id 
  LIMIT 1
)
WHERE brand_id IS NULL;

-- Ensure all users have consistent brand_id/business_id
UPDATE users 
SET business_id = brand_id
WHERE business_id IS DISTINCT FROM brand_id;

-- Fix products with NULL brand_id
UPDATE products 
SET brand_id = (
  SELECT brand_id 
  FROM outlets 
  WHERE outlets.id = products.outlet_id 
  LIMIT 1
)
WHERE brand_id IS NULL AND outlet_id IS NOT NULL;

-- 11. VIEWS FOR MONITORING
-- ========================================

-- View for user activity by brand
CREATE OR REPLACE VIEW brand_user_summary AS
SELECT 
  brand_id,
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE is_active = true) as active_users,
  COUNT(*) FILTER (WHERE is_verified = true) as verified_users,
  COUNT(*) FILTER (WHERE last_login > NOW() - INTERVAL '7 days') as recent_logins,
  array_agg(DISTINCT role) as roles
FROM users
GROUP BY brand_id;

-- View for order statistics by brand
CREATE OR REPLACE VIEW brand_order_summary AS
SELECT 
  brand_id,
  COUNT(*) as total_orders,
  COUNT(*) FILTER (WHERE order_status = 'CLOSED') as completed_orders,
  SUM(billing_total) as total_revenue,
  AVG(billing_total) as avg_order_value,
  MAX(created_at) as last_order
FROM orders
GROUP BY brand_id;

-- 12. TRIGGERS FOR DATA INTEGRITY
-- ========================================

-- Function to prevent cross-tenant data leaks
CREATE OR REPLACE FUNCTION prevent_cross_tenant_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure brand_id is set for all inserts/updates
  IF NEW.brand_id IS NULL THEN
    RAISE EXCEPTION 'brand_id is required for tenant isolation';
  END IF;
  
  -- For updates, prevent brand_id changes
  IF TG_OP = 'UPDATE' AND OLD.brand_id IS DISTINCT FROM NEW.brand_id THEN
    RAISE EXCEPTION 'brand_id cannot be changed (tenant isolation violation)';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to critical tables
DO $$
BEGIN
  -- Users table
  DROP TRIGGER IF EXISTS users_tenant_isolation_trigger ON users;
  CREATE TRIGGER users_tenant_isolation_trigger
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION prevent_cross_tenant_access();
  
  -- Outlets table
  DROP TRIGGER IF EXISTS outlets_tenant_isolation_trigger ON outlets;
  CREATE TRIGGER outlets_tenant_isolation_trigger
    BEFORE INSERT OR UPDATE ON outlets
    FOR EACH ROW EXECUTE FUNCTION prevent_cross_tenant_access();
  
  -- Products table
  DROP TRIGGER IF EXISTS products_tenant_isolation_trigger ON products;
  CREATE TRIGGER products_tenant_isolation_trigger
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION prevent_cross_tenant_access();
  
  -- Orders table
  DROP TRIGGER IF EXISTS orders_tenant_isolation_trigger ON orders;
  CREATE TRIGGER orders_tenant_isolation_trigger
    BEFORE INSERT OR UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION prevent_cross_tenant_access();
END $$;

COMMIT;
