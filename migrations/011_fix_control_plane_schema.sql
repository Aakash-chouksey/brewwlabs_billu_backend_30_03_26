-- ========================================
-- CONTROL PLANE SCHEMA FIXES
-- ========================================

-- 1. FIX BRANDS TABLE - Remove confusing businessId field
-- ========================================

-- Add comment to clarify brandId vs businessId confusion
COMMENT ON COLUMN brands.business_id IS 'DEPRECATED: Use brand.id as primary identifier. This field causes confusion with tenant business_id.';

-- Add constraint to prevent invalid mappings if business_id is used
ALTER TABLE brands ADD CONSTRAINT check_business_id_or_null 
  CHECK (business_id IS NULL OR business_id = id);

-- 2. ENHANCE TENANT_CONNECTIONS TABLE
-- ========================================

-- Add missing critical fields for connection management
ALTER TABLE tenant_connections 
ADD COLUMN IF NOT EXISTS encryption_version VARCHAR(10) DEFAULT 'v2',
ADD COLUMN IF NOT EXISTS last_connection_attempt TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_successful_connection TIMESTAMP,
ADD COLUMN IF NOT EXISTS connection_retries INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS db_region VARCHAR(50),
ADD COLUMN IF NOT EXISTS pool_max_connections INTEGER DEFAULT 4,
ADD COLUMN IF NOT EXISTS pool_min_connections INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS connection_health_score INTEGER DEFAULT 100;

-- Add validation constraints
ALTER TABLE tenant_connections 
ADD CONSTRAINT IF NOT EXISTS check_encryption_version 
  CHECK (encryption_version IN ('v1', 'v2', 'v3')),
ADD CONSTRAINT IF NOT EXISTS check_connection_retries 
  CHECK (connection_retries >= 0),
ADD CONSTRAINT IF NOT EXISTS check_pool_config 
  CHECK (pool_min_connections >= 0 AND pool_max_connections >= pool_min_connections),
ADD CONSTRAINT IF NOT EXISTS check_health_score 
  CHECK (connection_health_score >= 0 AND connection_health_score <= 100);

-- Add critical unique constraints
ALTER TABLE tenant_connections 
ADD CONSTRAINT IF NOT EXISTS unique_brand_id UNIQUE (brand_id),
ADD CONSTRAINT IF NOT EXISTS unique_db_host_name UNIQUE (db_host, db_name);

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_tenant_connections_status ON tenant_connections(status);
CREATE INDEX IF NOT EXISTS idx_tenant_connections_health ON tenant_connections(connection_health_score);
CREATE INDEX IF NOT EXISTS idx_tenant_connections_last_attempt ON tenant_connections(last_connection_attempt);

-- 3. ENCRYPTION VALIDATION
-- ========================================

-- Add function to validate encrypted password format
CREATE OR REPLACE FUNCTION validate_encrypted_password_format(encrypted_password TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if password follows iv:encrypted format (new format)
  IF encrypted_password ~ '^[a-f0-9]{32}:[a-f0-9]+$' THEN
    RETURN TRUE;
  END IF;
  
  -- Allow legacy format (hex only) for backward compatibility
  IF encrypted_password ~ '^[a-f0-9]+$' AND LENGTH(encrypted_password) > 32 THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Add check constraint for encrypted password format
ALTER TABLE tenant_connections 
ADD CONSTRAINT IF NOT EXISTS check_encrypted_password_format 
  CHECK (validate_encrypted_password_format(encrypted_password));

-- 4. AUDIT LOGGING FOR CONNECTION CHANGES
-- ========================================

-- Create trigger function to log connection changes
CREATE OR REPLACE FUNCTION log_tenant_connection_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Log critical field changes
    IF OLD.status IS DISTINCT FROM NEW.status OR 
       OLD.last_successful_connection IS DISTINCT FROM NEW.last_successful_connection OR
       OLD.connection_retries IS DISTINCT FROM NEW.connection_retries THEN
      INSERT INTO audit_logs (entity_type, entity_id, action, details, severity, ip_address, user_agent)
      VALUES (
        'tenant_connection',
        NEW.id,
        'CONNECTION_STATUS_CHANGE',
        json_build_object(
          'old_status', OLD.status,
          'new_status', NEW.status,
          'old_retries', OLD.connection_retries,
          'new_retries', NEW.connection_retries,
          'last_success', NEW.last_successful_connection
        ),
        'MEDIUM',
        inet_client_addr(),
        current_setting('application_name')
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if audit_logs table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    DROP TRIGGER IF EXISTS tenant_connection_changes_trigger ON tenant_connections;
    CREATE TRIGGER tenant_connection_changes_trigger
      AFTER UPDATE ON tenant_connections
      FOR EACH ROW EXECUTE FUNCTION log_tenant_connection_changes();
  END IF;
END $$;

-- 5. DATA MIGRATION FOR EXISTING RECORDS
-- ========================================

-- Update existing tenant_connections with default values
UPDATE tenant_connections 
SET 
  encryption_version = CASE 
    WHEN encrypted_password ~ '^[a-f0-9]{32}:[a-f0-9]+$' THEN 'v2'
    WHEN encrypted_password ~ '^[a-f0-9]+$' THEN 'v1'
    ELSE 'v2'
  END,
  status = COALESCE(status, 'ACTIVE'),
  connection_retries = COALESCE(connection_retries, 0),
  pool_max_connections = COALESCE(pool_max_connections, 4),
  pool_min_connections = COALESCE(pool_min_connections, 0),
  connection_health_score = COALESCE(connection_health_score, 100)
WHERE encryption_version IS NULL OR status IS NULL;

-- 6. VIEWS FOR MONITORING
-- ========================================

-- Create view for tenant connection health monitoring
CREATE OR REPLACE VIEW tenant_connection_health AS
SELECT 
  tc.id,
  tc.brand_id,
  b.name as brand_name,
  tc.db_host,
  tc.db_name,
  tc.status,
  tc.connection_health_score,
  tc.connection_retries,
  tc.last_successful_connection,
  tc.last_connection_attempt,
  CASE 
    WHEN tc.last_successful_connection IS NULL THEN 'NEVER_CONNECTED'
    WHEN tc.last_successful_connection > NOW() - INTERVAL '1 hour' THEN 'HEALTHY'
    WHEN tc.last_successful_connection > NOW() - INTERVAL '24 hours' THEN 'WARNING'
    ELSE 'CRITICAL'
  END as health_status,
  tc.encryption_version
FROM tenant_connections tc
JOIN brands b ON tc.brand_id = b.id;

-- 7. SECURITY POLICIES
-- ========================================

-- Row Level Security for tenant_connections (if needed)
-- ALTER TABLE tenant_connections ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_connection_isolation ON tenant_connections
--   FOR ALL TO super_admin_users
--   USING (true);

COMMIT;
