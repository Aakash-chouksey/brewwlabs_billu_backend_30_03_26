-- Migration: Add unique constraint for table_no within business and outlet
-- Description: Ensures table numbers are unique within each business outlet combination

-- Add unique constraint for table_no combination
-- This ensures that within the same business and outlet, table_no must be unique
-- Different businesses or outlets can have the same table_no

-- First, remove any duplicate table_no entries within the same business/outlet
-- This is a safety measure before adding the unique constraint
DO $$
BEGIN
    -- Log any duplicates that will be affected
    CREATE TEMPORARY TABLE duplicate_tables AS
    SELECT 
        business_id, 
        outlet_id, 
        table_no, 
        COUNT(*) as count,
        ARRAY_AGG(id) as duplicate_ids,
        MIN(id) as keep_id
    FROM tables 
    WHERE table_no IS NOT NULL 
    AND table_no != ''
    GROUP BY business_id, outlet_id, table_no 
    HAVING COUNT(*) > 1;
    
    -- If duplicates exist, log them and keep only the first one
    IF (SELECT COUNT(*) FROM duplicate_tables) > 0 THEN
        RAISE NOTICE 'Found duplicate table_no entries. Keeping first occurrence and removing duplicates:';
        
        -- Log the duplicates
        SELECT 
            business_id,
            outlet_id, 
            table_no,
            count,
            duplicate_ids,
            keep_id
        FROM duplicate_tables;
        
        -- Remove duplicates (keep the one with minimum id)
        DELETE FROM tables 
        WHERE id IN (
            SELECT unnest(duplicate_ids) 
            FROM duplicate_tables 
            WHERE duplicate_ids != ARRAY[keep_id]
        );
        
        RAISE NOTICE 'Duplicate table_no entries have been cleaned up.';
    END IF;
END $$;

-- Add the unique constraint for table_no within business and outlet
ALTER TABLE tables 
ADD CONSTRAINT tables_business_outlet_table_no_unique 
UNIQUE (business_id, outlet_id, table_no);

-- Add index for performance (if not already exists by the constraint)
CREATE INDEX IF NOT EXISTS idx_tables_business_outlet_table_no 
ON tables (business_id, outlet_id, table_no);

-- Log the completion
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Added unique constraint for table_no within business and outlet';
    RAISE NOTICE 'Table numbers must now be unique within each business outlet combination';
END $$;
