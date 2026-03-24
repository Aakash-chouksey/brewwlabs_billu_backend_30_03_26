-- ========================================
-- NEON-SAFE DATABASE RESET SCRIPT
-- ========================================
-- WARNING: This will DELETE ALL DATA and recreate clean structure
-- Run only during initial setup or complete reset

-- Start transaction
BEGIN;

-- ========================================
-- STEP 1: CLEANUP - Drop all tenant schemas
-- ========================================

DO $$
DECLARE
    schema_record RECORD;
BEGIN
    FOR schema_record IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'tenant_%'
    LOOP
        EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', schema_record.schema_name);
        RAISE NOTICE 'Dropped schema: %', schema_record.schema_name;
    END LOOP;
END $$;

-- ========================================
-- STEP 2: CLEANUP - Reset public schema
-- ========================================

-- Drop all tables in public schema (except extensions)
DO $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE 'pg_%'
        AND tablename NOT LIKE 'sql_%'
    LOOP
        EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', table_record.tablename);
        RAISE NOTICE 'Dropped table: %', table_record.tablename;
    END LOOP;
END $$;

-- ========================================
-- STEP 3: CLEANUP - Reset control plane
-- ========================================

-- Note: Control plane database should be handled separately
-- This script focuses on tenant database only

-- ========================================
-- STEP 4: CREATE CLEAN PUBLIC SCHEMA
-- ========================================

-- Ensure public schema exists and is clean
CREATE SCHEMA IF NOT EXISTS public;
GRANT ALL ON SCHEMA public TO public;

-- ========================================
-- STEP 5: CREATE SYSTEM TABLES (if needed in public)
-- ========================================

-- Tenant schema mappings table (tracks tenant → schema)
CREATE TABLE IF NOT EXISTS public.tenant_schema_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL UNIQUE,
    schema_name VARCHAR(255) NOT NULL UNIQUE,
    business_id UUID,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT tenant_schema_mappings_status_check CHECK (status IN ('active', 'inactive', 'suspended'))
);

-- Migration tracking
CREATE TABLE IF NOT EXISTS public.schema_migration_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schema_name VARCHAR(255) NOT NULL,
    migration_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ========================================
-- STEP 6: CREATE INDEXES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_tenant_mappings_tenant_id ON public.tenant_schema_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_mappings_schema_name ON public.tenant_schema_mappings(schema_name);
CREATE INDEX IF NOT EXISTS idx_tenant_mappings_business_id ON public.tenant_schema_mappings(business_id);
CREATE INDEX IF NOT EXISTS idx_tenant_mappings_status ON public.tenant_schema_mappings(status);

-- ========================================
-- STEP 7: CREATE TRIGGERS
-- ========================================

CREATE OR REPLACE FUNCTION update_tenant_mappings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenant_mappings_updated_at ON public.tenant_schema_mappings;
CREATE TRIGGER tenant_mappings_updated_at
    BEFORE UPDATE ON public.tenant_schema_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_tenant_mappings_timestamp();

-- ========================================
-- STEP 8: CREATE UTILITY FUNCTIONS
-- ========================================

-- Function to create tenant schema
CREATE OR REPLACE FUNCTION create_tenant_schema(p_schema_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = p_schema_name) THEN
        RAISE NOTICE 'Schema % already exists', p_schema_name;
        RETURN TRUE;
    END IF;
    
    EXECUTE format('CREATE SCHEMA %I', p_schema_name);
    RAISE NOTICE 'Created schema: %', p_schema_name;
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating schema %: %', p_schema_name, SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to drop tenant schema
CREATE OR REPLACE FUNCTION drop_tenant_schema(p_schema_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = p_schema_name) THEN
        RAISE NOTICE 'Schema % does not exist', p_schema_name;
        RETURN TRUE;
    END IF;
    
    EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', p_schema_name);
    RAISE NOTICE 'Dropped schema: %', p_schema_name;
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error dropping schema %: %', p_schema_name, SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to list all tenant schemas
CREATE OR REPLACE FUNCTION list_tenant_schemas()
RETURNS TABLE(schema_name TEXT, created_at TIMESTAMP WITH TIME ZONE) AS $$
BEGIN
    RETURN QUERY
    SELECT s.schema_name::TEXT, CURRENT_TIMESTAMP
    FROM information_schema.schemata s
    WHERE s.schema_name LIKE 'tenant_%'
    ORDER BY s.schema_name;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- STEP 9: SEED INITIAL DATA (Optional)
-- ========================================

-- Insert sample tenant mappings for testing (remove in production)
-- INSERT INTO public.tenant_schema_mappings (tenant_id, schema_name, business_id, status) VALUES
-- ('tenant_001', 'tenant_tenant_001', '550e8400-e29b-41d4-a716-446655440001', 'active'),
-- ('tenant_002', 'tenant_tenant_002', '550e8400-e29b-41d4-a716-446655440002', 'active');

-- ========================================
-- STEP 10: VERIFICATION
-- ========================================

-- Verify public schema is clean
DO $$
DECLARE
    table_count INTEGER;
    schema_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM pg_tables 
    WHERE schemaname = 'public';
    
    SELECT COUNT(*) INTO schema_count
    FROM information_schema.schemata 
    WHERE schema_name LIKE 'tenant_%';
    
    RAISE NOTICE 'Database reset complete:';
    RAISE NOTICE '- Public tables: %', table_count;
    RAISE NOTICE '- Tenant schemas: %', schema_count;
    RAISE NOTICE '- System ready for fresh tenant creation';
END $$;

-- Commit transaction
COMMIT;

-- ========================================
-- POST-RESET VERIFICATION QUERIES
-- ========================================

-- Verify tenant_schema_mappings table
-- SELECT * FROM public.tenant_schema_mappings;

-- List all schemas
-- SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%' ORDER BY schema_name;

-- Verify functions exist
-- SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE '%tenant%';
