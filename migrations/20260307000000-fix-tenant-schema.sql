-- IDEMPOTENT TENANT SCHEMA FIXES
-- This script ensures all tenant-specific tables and columns exist with correct naming and types.

-- Table: categories
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    outlet_id UUID,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(50),
    image VARCHAR(255),
    is_enabled BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_categories_business ON categories(business_id);
CREATE INDEX IF NOT EXISTS idx_categories_outlet ON categories(outlet_id);

-- Table: products
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    outlet_id UUID,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    cost DECIMAL(10, 2),
    sku VARCHAR(100),
    barcode VARCHAR(100),
    image VARCHAR(255),
    is_available BOOLEAN DEFAULT TRUE,
    track_stock BOOLEAN DEFAULT FALSE,
    stock DECIMAL(10, 2) DEFAULT 0,
    min_stock_level DECIMAL(10, 2) DEFAULT 0,
    max_stock_level DECIMAL(10, 2),
    unit VARCHAR(50),
    tax_rate DECIMAL(5, 4) DEFAULT 0.0000,
    recipe JSONB DEFAULT '[]',
    product_type VARCHAR(50) DEFAULT 'simple',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_outlet ON products(outlet_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

-- Table: table_areas
CREATE TABLE IF NOT EXISTS table_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    outlet_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_table_areas_business ON table_areas(business_id);
CREATE INDEX IF NOT EXISTS idx_table_areas_outlet ON table_areas(outlet_id);

-- Table: tables
CREATE TABLE IF NOT EXISTS tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    outlet_id UUID NOT NULL,
    area_id UUID REFERENCES table_areas(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    capacity INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'Available',
    current_order_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tables_business ON tables(business_id);
CREATE INDEX IF NOT EXISTS idx_tables_outlet ON tables(outlet_id);
CREATE INDEX IF NOT EXISTS idx_tables_area ON tables(area_id);

-- Table: inventory
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
    unit VARCHAR(50),
    min_stock DECIMAL(10, 2) DEFAULT 0,
    max_stock DECIMAL(10, 2),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_outlet ON inventory(outlet_id);

-- Ensure all tables have required columns if they were created with older schema
ALTER TABLE categories ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS outlet_id UUID;
ALTER TABLE products ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS outlet_id UUID;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS min_stock DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS max_stock DECIMAL(10, 2);
