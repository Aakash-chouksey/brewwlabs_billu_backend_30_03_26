-- =====================================================
-- CRITICAL SCHEMA FIX - PRODUCT TYPE STATUS COLUMN
-- =====================================================
-- 
-- This script fixes the missing 'status' column in product_types
-- tables across all tenant schemas.
-- 
-- Run this in your database console or via psql:
-- psql -d your_database -f fix_product_type_status.sql
-- 
-- Or run directly in a SQL query console as a single transaction

-- Start transaction
BEGIN;

-- Create a function to fix all tenant schemas
CREATE OR REPLACE FUNCTION fix_product_type_status()
RETURNS TABLE (
    schema_name TEXT,
    status TEXT,
    details TEXT
) AS $$
DECLARE
    schema_record RECORD;
    table_exists BOOLEAN;
    column_exists BOOLEAN;
BEGIN
    -- Loop through all tenant schemas
    FOR schema_record IN 
        SELECT s.schema_name::TEXT
        FROM information_schema.schemata s
        WHERE s.schema_name LIKE 'tenant_%'
        ORDER BY s.schema_name
    LOOP
        schema_name := schema_record.schema_name;
        
        -- Check if product_types table exists
        SELECT EXISTS(
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = schema_record.schema_name 
            AND table_name = 'product_types'
        ) INTO table_exists;
        
        IF NOT table_exists THEN
            status := 'SKIPPED';
            details := 'Table product_types does not exist';
            RETURN NEXT;
            CONTINUE;
        END IF;
        
        -- Check if status column exists
        SELECT EXISTS(
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = schema_record.schema_name 
            AND table_name = 'product_types'
            AND column_name = 'status'
        ) INTO column_exists;
        
        IF column_exists THEN
            status := 'OK';
            details := 'Column status already exists';
            RETURN NEXT;
        ELSE
            -- Add the status column
            EXECUTE format(
                'ALTER TABLE %I.product_types ADD COLUMN status VARCHAR(50) DEFAULT %L',
                schema_record.schema_name,
                'active'
            );
            
            -- Update existing records (shouldn't be needed with DEFAULT, but ensures consistency)
            EXECUTE format(
                'UPDATE %I.product_types SET status = %L WHERE status IS NULL',
                schema_record.schema_name,
                'active'
            );
            
            status := 'FIXED';
            details := 'Added status column with default active';
            RETURN NEXT;
        END IF;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Execute the fix function and show results
SELECT * FROM fix_product_type_status();

-- Drop the function after use (cleanup)
DROP FUNCTION IF EXISTS fix_product_type_status();

-- Commit transaction
COMMIT;

-- =====================================================
-- VERIFICATION QUERY (Run separately after commit)
-- =====================================================
-- 
-- This query checks all tenant schemas for the status column
--
/*
SELECT 
    t.table_schema,
    t.table_name,
    CASE WHEN c.column_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as status_column
FROM information_schema.tables t
LEFT JOIN information_schema.columns c 
    ON t.table_schema = c.table_schema 
    AND t.table_name = c.table_name 
    AND c.column_name = 'status'
WHERE t.table_schema LIKE 'tenant_%'
AND t.table_name = 'product_types'
ORDER BY t.table_schema;
*/
