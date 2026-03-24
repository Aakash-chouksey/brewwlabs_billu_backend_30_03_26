-- Add database_url field to tenant_connections table
ALTER TABLE tenant_connections 
ADD COLUMN database_url TEXT;

-- Create index on database_url for faster lookups
CREATE INDEX idx_tenant_connections_database_url ON tenant_connections(database_url);

-- Update existing records to build database_url from individual fields
UPDATE tenant_connections 
SET database_url = 'postgresql://' || db_user || ':' || 
    -- Note: This is a placeholder - passwords need to be decrypted properly
    'DECRYPTED_PASSWORD' || '@' || db_host || ':' || COALESCE(db_port::TEXT, '5432') || '/' || db_name
WHERE database_url IS NULL;
