-- Migration: Fix tenant_connections missing timestamp columns
-- This migration adds missing created_at and updated_at columns to tenant_connections table
-- Date: 2026-03-05

-- Check and add missing timestamp columns to tenant_connections table
DO $$
BEGIN
    -- Add created_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tenant_connections' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE tenant_connections 
        ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added created_at column to tenant_connections';
    END IF;

    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tenant_connections' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE tenant_connections 
        ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to tenant_connections';
    END IF;

    -- Create indexes for timestamp columns if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'tenant_connections' 
        AND indexname = 'idx_tenant_connections_created_at'
    ) THEN
        CREATE INDEX idx_tenant_connections_created_at ON tenant_connections(created_at);
        RAISE NOTICE 'Created index on tenant_connections.created_at';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'tenant_connections' 
        AND indexname = 'idx_tenant_connections_updated_at'
    ) THEN
        CREATE INDEX idx_tenant_connections_updated_at ON tenant_connections(updated_at);
        RAISE NOTICE 'Created index on tenant_connections.updated_at';
    END IF;
END $$;

-- Update any existing rows to have proper timestamps
UPDATE tenant_connections 
SET 
    created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, NOW())
WHERE created_at IS NULL OR updated_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN tenant_connections.created_at IS 'Timestamp when tenant connection was created';
COMMENT ON COLUMN tenant_connections.updated_at IS 'Timestamp when tenant connection was last updated';

-- Verify the fix
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tenant_connections' 
AND column_name IN ('created_at', 'updated_at')
ORDER BY column_name;
