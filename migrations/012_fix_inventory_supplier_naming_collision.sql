-- Migration: Fix InventoryItem supplier naming collision
-- Description: Add supplier_id foreign key and rename supplier field to supplier_name
-- This resolves the Sequelize naming collision between attribute and association

-- Add new columns for supplier relationship
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS supplier_id UUID,
ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(255);

-- Create index for supplier_id for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_items_supplier_id 
ON inventory_items (supplier_id);

-- Add foreign key constraint for supplier_id (references suppliers table)
-- Note: This will only work if the suppliers table exists in the tenant database
DO $$
BEGIN
    -- Check if suppliers table exists before adding foreign key
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_name = 'suppliers' 
               AND table_schema = current_schema()) THEN
        ALTER TABLE inventory_items 
        ADD CONSTRAINT fk_inventory_items_supplier 
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) 
        ON DELETE SET NULL ON UPDATE CASCADE;
        
        RAISE NOTICE 'Foreign key constraint added for supplier_id';
    ELSE
        RAISE NOTICE 'Suppliers table not found, skipping foreign key constraint';
    END IF;
END $$;

-- Migrate data from old supplier field (if it existed) to supplier_name
-- This handles the case where the supplier field contained text data
UPDATE inventory_items 
SET supplier_name = supplier 
WHERE supplier IS NOT NULL 
  AND supplier_name IS NULL;

-- Drop the old supplier column if it exists (this was the source of the collision)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'inventory_items' 
               AND column_name = 'supplier' 
               AND table_schema = current_schema()) THEN
        ALTER TABLE inventory_items DROP COLUMN supplier;
        RAISE NOTICE 'Dropped old supplier column to resolve naming collision';
    ELSE
        RAISE NOTICE 'Old supplier column not found, no need to drop';
    END IF;
END $$;

-- Add comments to document the changes
COMMENT ON COLUMN inventory_items.supplier_id IS 'Foreign key reference to suppliers table for structured supplier relationships';
COMMENT ON COLUMN inventory_items.supplier_name IS 'Text field for supplier name when supplier_id is not available (legacy support)';

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Fixed InventoryItem supplier naming collision';
    RAISE NOTICE 'Changes made:';
    RAISE NOTICE '1. Added supplier_id UUID column for foreign key relationship';
    RAISE NOTICE '2. Added supplier_name VARCHAR column for legacy supplier name support';
    RAISE NOTICE '3. Added index for supplier_id performance';
    RAISE NOTICE '4. Added foreign key constraint to suppliers table (if exists)';
    RAISE NOTICE '5. Migrated data from old supplier field to supplier_name';
    RAISE NOTICE '6. Dropped old supplier column to resolve naming collision';
    RAISE NOTICE '7. InventoryItem model now supports both supplier association and supplierName field';
END $$;
