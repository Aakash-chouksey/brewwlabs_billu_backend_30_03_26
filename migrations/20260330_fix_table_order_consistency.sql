-- ============================================================================
-- TABLE-ORDER CONSISTENCY FIX MIGRATION
-- Multi-tenant POS System - March 2026
-- ============================================================================
-- This migration fixes data consistency issues between tables and orders:
-- 1. Normalizes all table status values to uppercase
-- 2. Fixes OCCUPIED tables without current_order_id
-- 3. Fixes tables with current_order_id but not OCCUPIED
-- 4. Releases tables linked to completed/cancelled orders
-- ============================================================================

-- Start transaction
BEGIN;

-- ============================================================================
-- STEP 1: Normalize all status values to uppercase
-- ============================================================================

-- Update lowercase 'available' to 'AVAILABLE'
UPDATE tables 
SET status = 'AVAILABLE' 
WHERE LOWER(status) = 'available' AND status != 'AVAILABLE';

-- Update lowercase 'occupied' to 'OCCUPIED'
UPDATE tables 
SET status = 'OCCUPIED' 
WHERE LOWER(status) = 'occupied' AND status != 'OCCUPIED';

-- Update lowercase 'reserved' to 'RESERVED'
UPDATE tables 
SET status = 'RESERVED' 
WHERE LOWER(status) = 'reserved' AND status != 'RESERVED';

-- Update lowercase 'cleaning' to 'CLEANING'
UPDATE tables 
SET status = 'CLEANING' 
WHERE LOWER(status) = 'cleaning' AND status != 'CLEANING';

-- ============================================================================
-- STEP 2: Fix tables that are OCCUPIED but have no current_order_id
-- (Reset to AVAILABLE as there's no linked order)
-- ============================================================================

UPDATE tables 
SET status = 'AVAILABLE', 
    current_order_id = NULL 
WHERE status = 'OCCUPIED' 
  AND current_order_id IS NULL;

-- ============================================================================
-- STEP 3: Release tables linked to completed/cancelled orders
-- ============================================================================

-- Find and release tables linked to completed orders
UPDATE tables 
SET status = 'AVAILABLE',
    current_order_id = NULL
WHERE current_order_id IN (
    SELECT id FROM orders 
    WHERE status IN ('COMPLETED', 'CLOSED', 'CANCELLED')
);

-- ============================================================================
-- STEP 4: Ensure tables with active orders are marked OCCUPIED
-- ============================================================================

-- Get active orders (not completed/cancelled)
WITH active_orders AS (
    SELECT id, table_id, business_id, outlet_id
    FROM orders
    WHERE table_id IS NOT NULL
      AND status NOT IN ('COMPLETED', 'CLOSED', 'CANCELLED')
)

-- Update tables to OCCUPIED for active orders
UPDATE tables t
SET status = 'OCCUPIED',
    current_order_id = ao.id
FROM active_orders ao
WHERE t.id = ao.table_id
  AND t.business_id = ao.business_id
  AND (t.status != 'OCCUPIED' OR t.current_order_id IS NULL OR t.current_order_id != ao.id);

-- ============================================================================
-- STEP 5: Clear current_order_id for AVAILABLE tables (should not have order link)
-- ============================================================================

UPDATE tables 
SET current_order_id = NULL 
WHERE status = 'AVAILABLE' 
  AND current_order_id IS NOT NULL;

-- ============================================================================
-- STEP 6: Verify consistency - raise notice if issues found
-- ============================================================================

DO $$
DECLARE
    occupied_no_order INTEGER;
    available_with_order INTEGER;
    lowercase_status INTEGER;
BEGIN
    -- Check for occupied tables without order
    SELECT COUNT(*) INTO occupied_no_order
    FROM tables
    WHERE status = 'OCCUPIED' AND current_order_id IS NULL;
    
    -- Check for available tables with order link
    SELECT COUNT(*) INTO available_with_order
    FROM tables
    WHERE status = 'AVAILABLE' AND current_order_id IS NOT NULL;
    
    -- Check for lowercase status
    SELECT COUNT(*) INTO lowercase_status
    FROM tables
    WHERE status IS NOT NULL 
      AND status != UPPER(status);
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'CONSISTENCY CHECK RESULTS';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Occupied tables without order: %', occupied_no_order;
    RAISE NOTICE 'Available tables with order link: %', available_with_order;
    RAISE NOTICE 'Tables with lowercase status: %', lowercase_status;
    
    IF occupied_no_order = 0 AND available_with_order = 0 AND lowercase_status = 0 THEN
        RAISE NOTICE '✅ All consistency checks passed!';
    ELSE
        RAISE WARNING '⚠️ Some consistency issues may remain';
    END IF;
    
    RAISE NOTICE '========================================';
END $$;

-- Commit transaction
COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION QUERIES (run these manually to verify)
-- ============================================================================

-- Query 1: Check table status distribution
-- SELECT status, COUNT(*) as count FROM tables GROUP BY status;

-- Query 2: Check occupied tables with their orders
-- SELECT t.id, t.status, t.current_order_id, o.status as order_status
-- FROM tables t
-- LEFT JOIN orders o ON t.current_order_id = o.id
-- WHERE t.status = 'OCCUPIED';

-- Query 3: Check for any remaining consistency issues
-- SELECT 
--     COUNT(*) FILTER (WHERE status = 'OCCUPIED' AND current_order_id IS NULL) as occupied_no_order,
--     COUNT(*) FILTER (WHERE status = 'AVAILABLE' AND current_order_id IS NOT NULL) as available_with_order,
--     COUNT(*) FILTER (WHERE status IS NOT NULL AND status != UPPER(status)) as lowercase_status
-- FROM tables;
