-- Migration: POS Schema Modernization
-- Date: 2026-03-07

-- 1. Create order_items table (Replace JSONB in orders)
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    variant_id UUID,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    tax DECIMAL(10, 2) NOT NULL,
    brand_id UUID NOT NULL,
    outlet_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_brand_outlet ON order_items(brand_id, outlet_id);

-- 2. Create purchase_items table (Replace JSONB in purchases)
CREATE TABLE IF NOT EXISTS purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    cost_price DECIMAL(10, 2) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(50),
    brand_id UUID NOT NULL,
    outlet_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_brand_outlet ON purchase_items(brand_id, outlet_id);

-- 3. Modify orders table to add order_number
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number VARCHAR(50);
-- Adding a unique constraint for brand_id and order_number
-- Note: In a production shared DB, we might want this to be brand_id + order_number
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_order_number_per_brand') THEN
        ALTER TABLE orders ADD CONSTRAINT unique_order_number_per_brand UNIQUE (brand_id, order_number);
    END IF;
END $$;

-- 4. Fix audit_logs isolation
-- Check if brand_id already exists from a previous partially failed migration attempt
-- Based on previous list_dir, 007_add_audit_logs_business_id.sql exists but let's be safe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='brand_id') THEN
        ALTER TABLE audit_logs ADD COLUMN brand_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='outlet_id') THEN
        ALTER TABLE audit_logs ADD COLUMN outlet_id UUID;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_brand_id ON audit_logs(brand_id);

-- 5. Create counters table for sequential order numbering
CREATE TABLE IF NOT EXISTS brand_counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL UNIQUE,
    last_order_number INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
