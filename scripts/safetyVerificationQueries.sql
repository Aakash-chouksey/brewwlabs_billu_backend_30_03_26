-- ============================================
-- FINAL SAFETY VERIFICATION SQL QUERIES
-- Run these manually to verify schema safety
-- ============================================

-- STEP 1: Verify tenant schema exists and is properly named
-- Replace 'tenant_test' with your actual tenant schema name

-- Check schema exists
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name LIKE 'tenant_%';

-- STEP 2: Verify schema_versions structure
-- Run for a specific tenant schema:

-- Check schema_versions table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'tenant_test'  -- REPLACE with actual schema
AND table_name = 'schema_versions'
ORDER BY ordinal_position;

-- Verify version is PRIMARY KEY
SELECT kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'tenant_test'  -- REPLACE with actual schema
AND tc.table_name = 'schema_versions'
AND tc.constraint_type = 'PRIMARY KEY';

-- Check all versions (should be integers, no duplicates)
SELECT * FROM tenant_test.schema_versions ORDER BY version;  -- REPLACE with actual schema

-- STEP 3: Verify migration tracking
-- Check that versions prevent duplicates (this should fail if version 1 exists):
-- INSERT INTO tenant_test.schema_versions (version) VALUES (1);

-- STEP 4: Table completeness check
-- Count all tables in tenant schema
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'tenant_test'  -- REPLACE with actual schema
AND table_type = 'BASE TABLE';

-- List all tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'tenant_test'  -- REPLACE with actual schema
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Verify critical tables exist
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'tenant_test' AND table_name = 'products') THEN '✓ products' ELSE '✗ products' END,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'tenant_test' AND table_name = 'orders') THEN '✓ orders' ELSE '✗ orders' END,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'tenant_test' AND table_name = 'inventory') THEN '✓ inventory' ELSE '✗ inventory' END,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'tenant_test' AND table_name = 'payments') THEN '✓ payments' ELSE '✗ payments' END;

-- STEP 5: Foreign Key Validation
-- List all FK constraints in tenant schema
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'tenant_test'  -- REPLACE with actual schema
ORDER BY tc.table_name;

-- STEP 6: Verify no tenant tables in public schema
-- This should return 0 results for proper isolation
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'products', 'orders', 'inventory', 'payments', 'customers',
    'outlets', 'order_items', 'inventory_items', 'recipes'
);

-- STEP 7: Check index completeness
-- Verify indexes on critical columns
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'tenant_test'  -- REPLACE with actual schema
AND (
    indexdef LIKE '%business_id%'
    OR indexdef LIKE '%outlet_id%'
    OR indexdef LIKE '%product_id%'
    OR indexdef LIKE '%order_id%'
)
ORDER BY tablename, indexname;

-- ============================================
-- TENANT ISOLATION VERIFICATION
-- ============================================

-- Verify tenant_registry entry exists and matches schema
SELECT 
    tr.schema_name,
    tr.business_id,
    tr.status,
    EXISTS (
        SELECT 1 FROM information_schema.schemata 
        WHERE schema_name = tr.schema_name
    ) as schema_exists
FROM public.tenant_registry tr
WHERE tr.schema_name = 'tenant_test';  -- REPLACE with actual schema

-- ============================================
-- CORRECTIVE ACTIONS (if needed)
-- ============================================

-- If schema_versions has wrong structure, fix it:
/*
BEGIN;
-- Backup existing data
CREATE TABLE tenant_test.schema_versions_backup AS 
SELECT * FROM tenant_test.schema_versions;

-- Drop and recreate with correct structure
DROP TABLE tenant_test.schema_versions;

CREATE TABLE tenant_test.schema_versions (
    version INTEGER PRIMARY KEY,
    migration_name VARCHAR(255),
    description TEXT,
    checksum VARCHAR(64),
    applied_by VARCHAR(100),
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Restore data (convert if needed)
INSERT INTO tenant_test.schema_versions (version, applied_at)
SELECT 
    CASE 
        WHEN version ~ '^[0-9]+$' THEN version::INTEGER
        ELSE 0
    END,
    applied_at
FROM tenant_test.schema_versions_backup;

DROP TABLE tenant_test.schema_versions_backup;
COMMIT;
*/

-- ============================================
-- SAFETY CHECK SUMMARY
-- ============================================

-- Quick health check summary query
SELECT 
    'Schema Exists' as check_item,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.schemata WHERE schema_name = 'tenant_test'
    ) THEN '✓ PASS' ELSE '✗ FAIL' END as status
UNION ALL
SELECT 
    'Schema Versions Table',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'tenant_test' AND table_name = 'schema_versions'
    ) THEN '✓ PASS' ELSE '✗ FAIL' END
UNION ALL
SELECT 
    'Version is INTEGER PK',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns c
        JOIN information_schema.table_constraints tc ON c.table_name = tc.table_name
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE c.table_schema = 'tenant_test'
        AND c.table_name = 'schema_versions'
        AND c.column_name = 'version'
        AND c.data_type = 'integer'
        AND tc.constraint_type = 'PRIMARY KEY'
        AND kcu.column_name = 'version'
    ) THEN '✓ PASS' ELSE '✗ FAIL' END
UNION ALL
SELECT 
    'Has ~40+ Tables',
    CASE WHEN (
        SELECT COUNT(*) FROM information_schema.tables 
        WHERE table_schema = 'tenant_test' AND table_type = 'BASE TABLE'
    ) >= 40 THEN '✓ PASS' ELSE '⚠ WARNING' END
UNION ALL
SELECT 
    'No Tables in Public',
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('products', 'orders', 'inventory', 'payments')
    ) THEN '✓ PASS' ELSE '✗ FAIL' END;
