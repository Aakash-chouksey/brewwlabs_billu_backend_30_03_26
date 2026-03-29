-- Approve and activate user abhilashpatel112@gmail.com
-- Run this SQL in your PostgreSQL database

-- 1. Update user to ensure outlet_id is set and status is ACTIVE
UPDATE "public"."users" 
SET 
    outlet_id = '3ab71d82-93d6-45df-a264-062ce5668516',
    outlet_ids = '["3ab71d82-93d6-45df-a264-062ce5668516"]'::jsonb,
    is_active = true,
    is_verified = true,
    role = 'BusinessAdmin',
    panel_type = 'TENANT',
    status = 'ACTIVE'
WHERE email = 'abhilashpatel112@gmail.com';

-- 2. Ensure business is active
UPDATE "public"."businesses" 
SET 
    status = 'active',
    is_active = true,
    owner_id = '4b311b8f-2b2b-42dc-899c-c04160d9f749'
WHERE id = 'a82c81e7-ac94-4e9a-8b81-d0c8321ed5fd';

-- 3. Ensure tenant registry is ACTIVE
UPDATE "public"."tenant_registry" 
SET 
    status = 'ACTIVE',
    activated_at = NOW()
WHERE business_id = 'a82c81e7-ac94-4e9a-8b81-d0c8321ed5fd';

-- 4. Create outlet in tenant schema if not exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'tenant_a82c81e7-ac94-4e9a-8b81-d0c8321ed5fd') THEN
        INSERT INTO "tenant_a82c81e7-ac94-4e9a-8b81-d0c8321ed5fd"."outlets" (id, business_id, name, status, is_active, created_at, updated_at)
        VALUES ('3ab71d82-93d6-45df-a264-062ce5668516', 'a82c81e7-ac94-4e9a-8b81-d0c8321ed5fd', 'Main Outlet', 'active', true, NOW(), NOW())
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
    'a82c81e7-ac94-4e9a-8b81-d0c8321ed5fd',
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
