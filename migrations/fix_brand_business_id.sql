-- Fix brand business_id column to allow null values
-- This allows brand creation before business exists in onboarding flow

DO $$
BEGIN
    -- Check if the column exists and is NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'brands' 
        AND column_name = 'business_id' 
        AND is_nullable = 'NO'
    ) THEN
        -- Make the column nullable
        ALTER TABLE brands ALTER COLUMN business_id DROP NOT NULL;
        RAISE NOTICE 'Made brands.business_id nullable';
    END IF;
END $$;

-- Update table statistics
ANALYZE brands;
