-- ========================================
-- MINIMAL CRITICAL FIX
-- ========================================

-- STEP 1: Add brand_id to businesses table (CRITICAL)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'businesses' AND column_name = 'brand_id'
    ) THEN
        ALTER TABLE businesses ADD COLUMN brand_id UUID;
    END IF;
END $$;

-- STEP 2: Add basic index for businesses.brand_id
CREATE INDEX IF NOT EXISTS idx_businesses_brand_id ON businesses(brand_id);

-- STEP 3: Update data consistency
UPDATE businesses 
SET brand_id = brands.id 
FROM brands 
WHERE brands.business_id = businesses.id 
AND businesses.brand_id IS NULL;

-- STEP 4: Update table statistics
ANALYZE businesses;
