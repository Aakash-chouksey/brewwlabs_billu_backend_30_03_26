--
-- Migration: Add SKU column to products table
-- Created: 2026-03-27
--

-- Add sku column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS sku VARCHAR(255);

-- Create index for faster SKU lookups
CREATE INDEX IF NOT EXISTS idx_products_sku 
ON products(sku);

-- Add comment explaining the column
COMMENT ON COLUMN products.sku IS 'Stock Keeping Unit - product identifier code';
