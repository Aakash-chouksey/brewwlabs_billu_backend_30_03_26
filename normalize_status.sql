-- ============================================================
-- SYSTEM-WIDE STATUS NORMALIZATION SCRIPT
-- Run this to fix all inconsistent status values
-- ============================================================

-- Step 1: Normalize all status values to UPPERCASE
UPDATE public.users SET status = UPPER(COALESCE(status, 'PENDING'));
UPDATE public.businesses SET status = UPPER(COALESCE(status, 'PENDING'));
UPDATE public.tenant_registry SET status = UPPER(COALESCE(status, 'PENDING'));
UPDATE public.subscriptions SET status = UPPER(COALESCE(status, 'PENDING'));
UPDATE public.plans SET status = UPPER(COALESCE(status, 'DRAFT'));

-- Step 2: Ensure outlet_id is set for all ACTIVE users
UPDATE public.users u
SET outlet_id = (
    SELECT o.id 
    FROM "tenant_" || REPLACE(u.business_id::text, '-', '_') || "".outlets o 
    WHERE o.business_id = u.business_id 
    LIMIT 1
)
WHERE u.status = 'ACTIVE' 
AND u.outlet_id IS NULL
AND EXISTS (
    SELECT 1 FROM information_schema.schemata 
    WHERE schema_name = 'tenant_' || REPLACE(u.business_id::text, '-', '_')
);

-- Step 3: Ensure outlet_ids JSON array contains the outlet_id
UPDATE public.users
SET outlet_ids = CASE 
    WHEN outlet_id IS NOT NULL THEN jsonb_build_array(outlet_id)
    ELSE '[]'::jsonb
END
WHERE outlet_ids IS NULL 
   OR outlet_ids = '[]'::jsonb 
   OR outlet_ids::text = 'null'
   OR outlet_id IS NOT NULL;

-- Step 4: Fix orphaned users (ACTIVE but no outlet assignment)
-- Set to PENDING if no outlet
UPDATE public.users
SET status = 'PENDING'
WHERE status = 'ACTIVE' 
AND outlet_id IS NULL;

-- Step 5: Verify normalization
SELECT 'users' as table_name, status, count(*) 
FROM public.users 
GROUP BY status
UNION ALL
SELECT 'businesses', status, count(*) 
FROM public.businesses 
GROUP BY status
UNION ALL
SELECT 'tenant_registry', status, count(*) 
FROM public.tenant_registry 
GROUP BY status
ORDER BY table_name, status;
