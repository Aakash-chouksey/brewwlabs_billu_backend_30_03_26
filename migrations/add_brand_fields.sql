-- Add missing fields to brands table

DO $$
BEGIN
    -- Add email column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'brands' AND column_name = 'email'
    ) THEN
        ALTER TABLE brands ADD COLUMN email VARCHAR(255) NOT NULL DEFAULT '';
        ALTER TABLE brands ADD CONSTRAINT brands_email_unique UNIQUE (email);
    END IF;
    
    -- Add phone column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'brands' AND column_name = 'phone'
    ) THEN
        ALTER TABLE brands ADD COLUMN phone VARCHAR(50);
    END IF;
    
    -- Add address column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'brands' AND column_name = 'address'
    ) THEN
        ALTER TABLE brands ADD COLUMN address TEXT;
    END IF;
END $$;

-- Update table statistics
ANALYZE brands;
