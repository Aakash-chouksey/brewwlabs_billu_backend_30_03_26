-- UUID Migration Script
-- Convert all TEXT ID fields to UUID type for consistency

-- Control Plane Tables
ALTER TABLE brands 
ALTER COLUMN id TYPE UUID USING id::uuid,
ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;

ALTER TABLE tenant_connections 
ALTER COLUMN brand_id TYPE UUID USING brand_id::uuid,
ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;

ALTER TABLE subscriptions 
ALTER COLUMN brand_id TYPE UUID USING brand_id::uuid,
ALTER COLUMN plan_id TYPE UUID USING plan_id::uuid;

ALTER TABLE plans 
ALTER COLUMN id TYPE UUID USING id::uuid;

ALTER TABLE super_admin_users 
ALTER COLUMN id TYPE UUID USING id::uuid;

ALTER TABLE cluster_metadata 
ALTER COLUMN id TYPE UUID USING id::uuid;

ALTER TABLE tenant_migration_log 
ALTER COLUMN brand_id TYPE UUID USING brand_id::uuid,
ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;

-- Tenant Database Tables
ALTER TABLE users 
ALTER COLUMN id TYPE UUID USING id::uuid,
ALTER COLUMN brand_id TYPE UUID USING brand_id::uuid,
ALTER COLUMN outlet_id TYPE UUID USING outlet_id::uuid;

ALTER TABLE outlets 
ALTER COLUMN id TYPE UUID USING id::uuid,
ALTER COLUMN brand_id TYPE UUID USING brand_id::uuid;

ALTER TABLE categories 
ALTER COLUMN id TYPE UUID USING id::uuid,
ALTER COLUMN brand_id TYPE UUID USING brand_id::uuid,
ALTER COLUMN outlet_id TYPE UUID USING outlet_id::uuid;

ALTER TABLE products 
ALTER COLUMN id TYPE UUID USING id::uuid,
ALTER COLUMN brand_id TYPE UUID USING brand_id::uuid,
ALTER COLUMN outlet_id TYPE UUID USING outlet_id::uuid,
ALTER COLUMN category_id TYPE UUID USING category_id::uuid;

ALTER TABLE customers 
ALTER COLUMN id TYPE UUID USING id::uuid,
ALTER COLUMN brand_id TYPE UUID USING brand_id::uuid,
ALTER COLUMN outlet_id TYPE UUID USING outlet_id::uuid;

ALTER TABLE orders 
ALTER COLUMN id TYPE UUID USING id::uuid,
ALTER COLUMN brand_id TYPE UUID USING brand_id::uuid,
ALTER COLUMN outlet_id TYPE UUID USING outlet_id::uuid,
ALTER COLUMN customer_id TYPE UUID USING customer_id::uuid;

ALTER TABLE order_items 
ALTER COLUMN id TYPE UUID USING id::uuid,
ALTER COLUMN order_id TYPE UUID USING order_id::uuid,
ALTER COLUMN product_id TYPE UUID USING product_id::uuid,
ALTER COLUMN brand_id TYPE UUID USING brand_id::uuid,
ALTER COLUMN outlet_id TYPE UUID USING outlet_id::uuid;

ALTER TABLE inventory 
ALTER COLUMN id TYPE UUID USING id::uuid,
ALTER COLUMN product_id TYPE UUID USING product_id::uuid,
ALTER COLUMN brand_id TYPE UUID USING brand_id::uuid,
ALTER COLUMN outlet_id TYPE UUID USING outlet_id::uuid;

ALTER TABLE inventory_purchases 
ALTER COLUMN id TYPE UUID USING id::uuid,
ALTER COLUMN product_id TYPE UUID USING product_id::uuid,
ALTER COLUMN brand_id TYPE UUID USING brand_id::uuid,
ALTER COLUMN outlet_id TYPE UUID USING outlet_id::uuid;

ALTER TABLE inventory_sales 
ALTER COLUMN id TYPE UUID USING id::uuid,
ALTER COLUMN product_id TYPE UUID USING product_id::uuid,
ALTER COLUMN order_id TYPE UUID USING order_id::uuid,
ALTER COLUMN brand_id TYPE UUID USING brand_id::uuid,
ALTER COLUMN outlet_id TYPE UUID USING outlet_id::uuid;

ALTER TABLE raw_materials 
ALTER COLUMN id TYPE UUID USING id::uuid,
ALTER COLUMN brand_id TYPE UUID USING brand_id::uuid,
ALTER COLUMN outlet_id TYPE UUID USING outlet_id::uuid;

ALTER TABLE recipes 
ALTER COLUMN id TYPE UUID USING id::uuid,
ALTER COLUMN product_id TYPE UUID USING product_id::uuid,
ALTER COLUMN brand_id TYPE UUID USING brand_id::uuid,
ALTER COLUMN outlet_id TYPE UUID USING outlet_id::uuid;

ALTER TABLE recipe_ingredients 
ALTER COLUMN id TYPE UUID USING id::uuid,
ALTER COLUMN recipe_id TYPE UUID USING recipe_id::uuid,
ALTER COLUMN raw_material_id TYPE UUID USING raw_material_id::uuid,
ALTER COLUMN brand_id TYPE UUID USING brand_id::uuid,
ALTER COLUMN outlet_id TYPE UUID USING outlet_id::uuid;

ALTER TABLE tables 
ALTER COLUMN id TYPE UUID USING id::uuid,
ALTER COLUMN brand_id TYPE UUID USING brand_id::uuid,
ALTER COLUMN outlet_id TYPE UUID USING outlet_id::uuid;

ALTER TABLE payments 
ALTER COLUMN id TYPE UUID USING id::uuid,
ALTER COLUMN order_id TYPE UUID USING order_id::uuid,
ALTER COLUMN brand_id TYPE UUID USING brand_id::uuid,
ALTER COLUMN outlet_id TYPE UUID USING outlet_id::uuid;

ALTER TABLE expenses 
ALTER COLUMN id TYPE UUID USING id::uuid,
ALTER COLUMN brand_id TYPE UUID USING brand_id::uuid,
ALTER COLUMN outlet_id TYPE UUID USING outlet_id::uuid;

ALTER TABLE expense_types 
ALTER COLUMN id TYPE UUID USING id::uuid,
ALTER COLUMN brand_id TYPE UUID USING brand_id::uuid,
ALTER COLUMN outlet_id TYPE UUID USING outlet_id::uuid;

ALTER TABLE areas 
ALTER COLUMN id TYPE UUID USING id::uuid,
ALTER COLUMN brand_id TYPE UUID USING brand_id::uuid,
ALTER COLUMN outlet_id TYPE UUID USING outlet_id::uuid;

ALTER TABLE timings 
ALTER COLUMN id TYPE UUID USING id::uuid,
ALTER COLUMN brand_id TYPE UUID USING brand_id::uuid,
ALTER COLUMN outlet_id TYPE UUID USING outlet_id::uuid;

-- Accounting Tables
ALTER TABLE accounting_entries 
ALTER COLUMN id TYPE UUID USING id::uuid,
ALTER COLUMN brand_id TYPE UUID USING brand_id::uuid,
ALTER COLUMN outlet_id TYPE UUID USING outlet_id::uuid;

ALTER TABLE transaction_logs 
ALTER COLUMN id TYPE UUID USING id::uuid,
ALTER COLUMN brand_id TYPE UUID USING brand_id::uuid,
ALTER COLUMN outlet_id TYPE UUID USING outlet_id::uuid;

-- Audit Logs (Control Plane)
ALTER TABLE audit_logs 
ALTER COLUMN id TYPE UUID USING id::uuid,
ALTER COLUMN user_id TYPE UUID USING user_id::uuid;

COMMIT;
