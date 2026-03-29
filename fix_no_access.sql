-- Fix No Access Error for billucafe10@cafe.com
-- Run this SQL in your PostgreSQL database

-- 1. Update user to ensure outlet_id is set
UPDATE "public"."users" 
SET 
    outlet_id = 'ba1909bd-a0d6-4677-8a5d-42eed87ea75e',
    outlet_ids = '["ba1909bd-a0d6-4677-8a5d-42eed87ea75e"]'::jsonb,
    is_active = true,
    is_verified = true,
    role = 'BusinessAdmin',
    panel_type = 'TENANT'
WHERE email = 'billucafe10@cafe.com';

-- 2. Ensure business is active
UPDATE "public"."businesses" 
SET 
    status = 'active',
    is_active = true,
    owner_id = '7dee1cfc-4248-4c98-ad80-8ccc650bdb42'
WHERE id = 'c7a5214c-ca68-45ce-a227-44beaa64ddb9';

-- 3. Ensure tenant registry is ACTIVE
UPDATE "public"."tenant_registry" 
SET 
    status = 'ACTIVE',
    activated_at = NOW()
WHERE business_id = 'c7a5214c-ca68-45ce-a227-44beaa64ddb9';

-- 4. Create outlet in tenant schema if not exists
-- First check if schema exists
DO $$
BEGIN
    -- Check if the outlet exists in the tenant schema
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'tenant_c7a5214c-ca68-45ce-a227-44beaa64ddb9') THEN
        -- Insert or update outlet
        INSERT INTO "tenant_c7a5214c-ca68-45ce-a227-44beaa64ddb9"."outlets" (id, business_id, name, status, is_active, created_at, updated_at)
        VALUES ('ba1909bd-a0d6-4677-8a5d-42eed87ea75e', 'c7a5214c-ca68-45ce-a227-44beaa64ddb9', 'Main Outlet', 'active', true, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
            status = 'active',
            is_active = true,
            updated_at = NOW();
    END IF;
END $$;

-- 5. Create or update subscription
INSERT INTO "public"."subscriptions" (id, business_id, plan_id, status, billing_cycle, current_period_start, current_period_end)
VALUES (
    gen_random_uuid(),
    'c7a5214c-ca68-45ce-a227-44beaa64ddb9',
    (SELECT id FROM "public"."plans" WHERE is_active = true LIMIT 1),
    'active',
    'monthly',
    NOW(),
    NOW() + INTERVAL '1 year'
)
ON CONFLICT (business_id) DO UPDATE SET
    status = 'active',
    current_period_start = NOW(),
    current_period_end = NOW() + INTERVAL '1 year';
