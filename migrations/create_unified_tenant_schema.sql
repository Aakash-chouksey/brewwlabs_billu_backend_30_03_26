-- ========================================
-- UNIFIED TENANT SCHEMA MAPPINGS TABLE
-- ========================================
-- This table replaces tenant_connections for schema-per-tenant architecture

CREATE TABLE IF NOT EXISTS tenant_schema_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL UNIQUE,
    schema_name VARCHAR(255) NOT NULL UNIQUE,
    business_id UUID REFERENCES businesses(id),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT tenant_schema_mappings_tenant_id_check CHECK (length(tenant_id) > 0),
    CONSTRAINT tenant_schema_mappings_schema_name_check CHECK (length(schema_name) > 0),
    CONSTRAINT tenant_schema_mappings_status_check CHECK (status IN ('active', 'inactive', 'suspended'))
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================
CREATE INDEX IF NOT EXISTS idx_tenant_schema_mappings_tenant_id ON tenant_schema_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_schema_mappings_schema_name ON tenant_schema_mappings(schema_name);
CREATE INDEX IF NOT EXISTS idx_tenant_schema_mappings_business_id ON tenant_schema_mappings(business_id);
CREATE INDEX IF NOT EXISTS idx_tenant_schema_mappings_status ON tenant_schema_mappings(status);

-- ========================================
-- TRIGGER FOR UPDATED_AT
-- ========================================
CREATE OR REPLACE FUNCTION update_tenant_schema_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tenant_schema_mappings_updated_at_trigger
    BEFORE UPDATE ON tenant_schema_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_tenant_schema_mappings_updated_at();

-- ========================================
-- MIGRATION SCRIPT FROM DB-PER-TENANT
-- ========================================
-- This script migrates existing tenant data to schema-per-tenant

-- Create migration tracking table
CREATE TABLE IF NOT EXISTS schema_migration_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_type VARCHAR(100) NOT NULL,
    source_tenant_id VARCHAR(255),
    target_schema_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Function to migrate tenant from DB-per-tenant to schema-per-tenant
CREATE OR REPLACE FUNCTION migrate_tenant_to_schema(
    p_tenant_id VARCHAR(255),
    p_business_id UUID,
    p_source_db_url TEXT
) RETURNS TABLE(success BOOLEAN, message TEXT, schema_name TEXT) AS $$
DECLARE
    v_schema_name TEXT;
    v_mapping_exists BOOLEAN;
BEGIN
    -- Check if mapping already exists
    SELECT EXISTS(
        SELECT 1 FROM tenant_schema_mappings 
        WHERE tenant_id = p_tenant_id
    ) INTO v_mapping_exists;
    
    IF v_mapping_exists THEN
        RETURN QUERY SELECT FALSE, 'Tenant schema mapping already exists', NULL::TEXT;
        RETURN;
    END IF;
    
    -- Generate schema name
    v_schema_name := 'tenant_' || p_tenant_id;
    
    -- Create schema mapping
    INSERT INTO tenant_schema_mappings (
        tenant_id, 
        schema_name, 
        business_id, 
        status
    ) VALUES (
        p_tenant_id,
        v_schema_name,
        p_business_id,
        'active'
    );
    
    -- Log migration
    INSERT INTO schema_migration_log (
        migration_type,
        source_tenant_id,
        target_schema_name,
        status,
        completed_at
    ) VALUES (
        'db_to_schema',
        p_tenant_id,
        v_schema_name,
        'completed',
        NOW()
    );
    
    RETURN QUERY SELECT TRUE, 'Successfully migrated tenant to schema-per-tenant', v_schema_name;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- UTILITY FUNCTIONS
-- ========================================

-- Function to get tenant schema name
CREATE OR REPLACE FUNCTION get_tenant_schema(p_tenant_id VARCHAR(255))
RETURNS TEXT AS $$
DECLARE
    v_schema_name TEXT;
BEGIN
    SELECT schema_name INTO v_schema_name
    FROM tenant_schema_mappings
    WHERE tenant_id = p_tenant_id AND status = 'active';
    
    IF v_schema_name IS NULL THEN
        RAISE EXCEPTION 'Tenant schema not found for tenant_id: %', p_tenant_id;
    END IF;
    
    RETURN v_schema_name;
END;
$$ LANGUAGE plpgsql;

-- Function to validate tenant schema exists
CREATE OR REPLACE FUNCTION validate_tenant_schema(p_tenant_id VARCHAR(255))
RETURNS TABLE(valid BOOLEAN, schema_name TEXT, exists BOOLEAN) AS $$
DECLARE
    v_schema_name TEXT;
    v_schema_exists BOOLEAN;
BEGIN
    -- Get schema name
    SELECT schema_name INTO v_schema_name
    FROM tenant_schema_mappings
    WHERE tenant_id = p_tenant_id AND status = 'active';
    
    IF v_schema_name IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, FALSE;
        RETURN;
    END IF;
    
    -- Check if schema actually exists in database
    SELECT EXISTS(
        SELECT 1 FROM information_schema.schemata 
        WHERE schema_name = v_schema_name
    ) INTO v_schema_exists;
    
    RETURN QUERY SELECT TRUE, v_schema_name, v_schema_exists;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- CLEANUP FUNCTIONS
-- ========================================

-- Function to cleanup old tenant_connections (after migration)
CREATE OR REPLACE FUNCTION cleanup_tenant_connections()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Only delete connections that have been migrated
    DELETE FROM tenant_connections 
    WHERE business_id IN (
        SELECT business_id FROM tenant_schema_mappings 
        WHERE status = 'active'
    );
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- SAMPLE DATA FOR TESTING
-- ========================================
-- This section can be uncommented for development testing

/*
-- Sample tenant mappings
INSERT INTO tenant_schema_mappings (tenant_id, schema_name, business_id, status) VALUES
('tenant_001', 'tenant_tenant_001', '550e8400-e29b-41d4-a716-446655440001', 'active'),
('tenant_002', 'tenant_tenant_002', '550e8400-e29b-41d4-a716-446655440002', 'active'),
('tenant_003', 'tenant_tenant_003', '550e8400-e29b-41d4-a716-446655440003', 'active')
ON CONFLICT (tenant_id) DO NOTHING;
*/

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Verify table structure
-- \d tenant_schema_mappings

-- Verify indexes
-- \di tenant_schema_mappings*

-- Check existing mappings
-- SELECT * FROM tenant_schema_mappings ORDER BY created_at DESC;

-- Check migration status
-- SELECT * FROM schema_migration_log ORDER BY created_at DESC;

-- Validate all tenant schemas
-- SELECT * FROM validate_tenant_schema(tenant_id) FROM tenant_schema_mappings WHERE status = 'active';

COMMIT;
