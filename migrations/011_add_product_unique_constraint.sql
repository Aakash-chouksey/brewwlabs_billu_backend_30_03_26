-- Add unique constraint for product names within categories
-- This prevents duplicate products in the same category for the same brand

-- Create unique index on brand_id, category_id, and name
CREATE UNIQUE INDEX IF NOT EXISTS "products_brand_id_category_id_name_key" 
ON "products" ("brand_id", "category_id", "name");

-- Add comment to explain the constraint
COMMENT ON INDEX "products_brand_id_category_id_name_key" IS 'Prevents duplicate product names within the same category for the same brand';
