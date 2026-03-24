-- IDEMPOTENT SCHEMA FIXES
-- Generated on 2026-03-05T19:44:52.912Z

-- [CONTROL PLANE]
ALTER TABLE brands ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE;
-- TODO: Missing table subscriptions. Suggest running full migration sync.
-- TODO: Missing table plans. Suggest running full migration sync.
-- TODO: Missing table cluster_metadata. Suggest running full migration sync.
ALTER TABLE super_admin_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE;
-- TODO: Missing table tenant_migration_log. Suggest running full migration sync.

-- [TENANTS]
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_categories VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_users_business ON users(business_id);
ALTER TABLE user_outlets ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_user_outlets_outlet ON user_outlets(outlet_id);
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS settings VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_outlets_business ON outlets(business_id);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS outlet_id UUID;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order DECIMAL(10,2);
CREATE INDEX IF NOT EXISTS idx_categories_outlet ON categories(outlet_id);
CREATE INDEX IF NOT EXISTS idx_categories_business ON categories(business_id);
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS business_id UUID;
CREATE INDEX IF NOT EXISTS idx_product_types_outlet ON product_types(outlet_id);
CREATE INDEX IF NOT EXISTS idx_product_types_business ON product_types(business_id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID;
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type_id UUID;
ALTER TABLE products ADD COLUMN IF NOT EXISTS outlet_id UUID;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_available BOOLEAN;
ALTER TABLE products ADD COLUMN IF NOT EXISTS track_stock DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock_level DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS max_stock_level DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS recipe VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_products_outlet ON products(outlet_id);
CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS business_id UUID;
CREATE INDEX IF NOT EXISTS idx_inventory_outlet ON inventory(outlet_id);
CREATE INDEX IF NOT EXISTS idx_inventory_business ON inventory(business_id);
ALTER TABLE table_areas ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE table_areas ADD COLUMN IF NOT EXISTS description VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_table_areas_outlet ON table_areas(outlet_id);
CREATE INDEX IF NOT EXISTS idx_table_areas_business ON table_areas(business_id);
ALTER TABLE tables ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS area_id UUID;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS outlet_id UUID;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS status VARCHAR(255);
ALTER TABLE tables ADD COLUMN IF NOT EXISTS current_order_id UUID;
CREATE INDEX IF NOT EXISTS idx_tables_outlet ON tables(outlet_id);
CREATE INDEX IF NOT EXISTS idx_tables_business ON tables(business_id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS waiter_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS outlet_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paymentmethod VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paymentstatus VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_orders_outlet ON orders(outlet_id);
CREATE INDEX IF NOT EXISTS idx_orders_business ON orders(business_id);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS order_id UUID;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_id UUID;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total_price DECIMAL(10,2);
