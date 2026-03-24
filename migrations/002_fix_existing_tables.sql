-- Migration: Add business_id columns to existing tenant tables
-- This migration adds business_id fields to tables that are missing them

-- Add business_id to products table (this is the main one causing the error)
ALTER TABLE products ADD COLUMN IF NOT EXISTS business_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE products ADD CONSTRAINT IF NOT EXISTS products_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- Add business_id to other tables that might be missing it
ALTER TABLE categories ADD COLUMN IF NOT EXISTS business_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE categories ADD CONSTRAINT IF NOT EXISTS categories_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS business_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE orders ADD CONSTRAINT IF NOT EXISTS orders_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE tables ADD COLUMN IF NOT EXISTS business_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE tables ADD CONSTRAINT IF NOT EXISTS tables_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE product_types ADD COLUMN IF NOT EXISTS business_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE product_types ADD CONSTRAINT IF NOT EXISTS product_types_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE inventory_categories ADD COLUMN IF NOT EXISTS business_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE inventory_categories ADD CONSTRAINT IF NOT EXISTS inventory_categories_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_categories_business_id ON categories(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_business_id ON orders(business_id);
CREATE INDEX IF NOT EXISTS idx_tables_business_id ON tables(business_id);
CREATE INDEX IF NOT EXISTS idx_product_types_business_id ON product_types(business_id);
CREATE INDEX IF NOT EXISTS idx_inventory_categories_business_id ON inventory_categories(business_id);

-- Add outlet_id columns where needed for outlet-level operations
ALTER TABLE products ADD COLUMN IF NOT EXISTS outlet_id UUID;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS outlet_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS outlet_id UUID;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS outlet_id UUID;
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS outlet_id UUID;
ALTER TABLE inventory_categories ADD COLUMN IF NOT EXISTS outlet_id UUID;

-- Add outlet indexes
CREATE INDEX IF NOT EXISTS idx_products_outlet_id ON products(outlet_id);
CREATE INDEX IF NOT EXISTS idx_categories_outlet_id ON categories(outlet_id);
CREATE INDEX IF NOT EXISTS idx_orders_outlet_id ON orders(outlet_id);
CREATE INDEX IF NOT EXISTS idx_tables_outlet_id ON tables(outlet_id);
CREATE INDEX IF NOT EXISTS idx_product_types_outlet_id ON product_types(outlet_id);
CREATE INDEX IF NOT EXISTS idx_inventory_categories_outlet_id ON inventory_categories(outlet_id);

-- Add composite indexes for tenant + outlet filtering
CREATE INDEX IF NOT EXISTS idx_products_business_outlet ON products(business_id, outlet_id);
CREATE INDEX IF NOT EXISTS idx_categories_business_outlet ON categories(business_id, outlet_id);
CREATE INDEX IF NOT EXISTS idx_orders_business_outlet ON orders(business_id, outlet_id);
CREATE INDEX IF NOT EXISTS idx_tables_business_outlet ON tables(business_id, outlet_id);
CREATE INDEX IF NOT EXISTS idx_product_types_business_outlet ON product_types(business_id, outlet_id);
CREATE INDEX IF NOT EXISTS idx_inventory_categories_business_outlet ON inventory_categories(business_id, outlet_id);

-- Update unique constraints to include business_id
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_name_key;
ALTER TABLE products ADD CONSTRAINT products_business_name_unique UNIQUE (business_id, outlet_id, name);

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;
ALTER TABLE categories ADD CONSTRAINT categories_business_name_unique UNIQUE (business_id, outlet_id, name);

ALTER TABLE tables DROP CONSTRAINT IF EXISTS tables_name_key;
ALTER TABLE tables ADD CONSTRAINT tables_business_name_unique UNIQUE (business_id, outlet_id, name);

ALTER TABLE product_types DROP CONSTRAINT IF EXISTS product_types_name_key;
ALTER TABLE product_types ADD CONSTRAINT product_types_business_name_unique UNIQUE (business_id, outlet_id, name);

ALTER TABLE inventory_categories DROP CONSTRAINT IF EXISTS inventory_categories_name_key;
ALTER TABLE inventory_categories ADD CONSTRAINT inventory_categories_business_name_unique UNIQUE (business_id, outlet_id, name);
