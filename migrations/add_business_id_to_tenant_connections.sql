-- Add business_id column to tenant_connections table

DO $$
BEGIN
    -- Add business_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tenant_connections' AND column_name = 'business_id'
    ) THEN
        ALTER TABLE tenant_connections ADD COLUMN business_id UUID;
        RAISE NOTICE 'Added business_id column to tenant_connections';
    END IF;
END $$;

-- Add index for business_id
CREATE INDEX IF NOT EXISTS idx_tenant_connections_business_id ON tenant_connections(business_id);

-- Update table statistics
ANALYZE tenant_connections;
