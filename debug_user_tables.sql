-- Debug Script: Print all tables and data for login debugging
-- Run this in your PostgreSQL database to see all relevant data

\echo '========================================'
\echo '1. USERS TABLE - All users'
\echo '========================================'
SELECT id, email, name, role, business_id, outlet_id, outlet_ids, status, is_active, is_verified, panel_type 
FROM public.users;

\echo ''
\echo '========================================'
\echo '2. BUSINESSES TABLE'
\echo '========================================'
SELECT id, name, status, is_active, owner_id, type 
FROM public.businesses;

\echo ''
\echo '========================================'
\echo '3. TENANT REGISTRY'
\echo '========================================'
SELECT id, business_id, schema_name, status, activated_at 
FROM public.tenant_registry;

\echo ''
\echo '========================================'
\echo '4. OUTLETS (in tenant schemas)'
\echo '========================================'
DO $$
DECLARE
    schema_record RECORD;
BEGIN
    FOR schema_record IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'tenant_%'
    LOOP
        RAISE NOTICE 'Schema: %', schema_record.schema_name;
        
        -- Check if outlets table exists in this schema
        IF EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = schema_record.schema_name 
            AND table_name = 'outlets'
        ) THEN
            EXECUTE format('SELECT id, name, business_id, status, is_active FROM %I.outlets', schema_record.schema_name);
        ELSE
            RAISE NOTICE '  No outlets table in %', schema_record.schema_name;
        END IF;
    END LOOP;
END $$;

\echo ''
\echo '========================================'
\echo '5. SPECIFIC USER DETAILS'
\echo '========================================'
-- Check for the users you've been trying to login with
\echo '--- User: abhilashpatel112@gmail.com ---'
SELECT * FROM public.users WHERE email = 'abhilashpatel112@gmail.com';

\echo ''
\echo '--- User: billucafe10@cafe.com ---'
SELECT * FROM public.users WHERE email = 'billucafe10@cafe.com';

\echo ''
\echo '--- User: billacafe10@cafe.com ---'
SELECT * FROM public.users WHERE email = 'billacafe10@cafe.com';

\echo ''
\echo '--- User: atmosphere@cafe.com ---'
SELECT * FROM public.users WHERE email = 'atmosphere@cafe.com';

\echo ''
\echo '========================================'
\echo '6. SUBSCRIPTIONS'
\echo '========================================'
SELECT id, business_id, plan_id, status, billing_cycle, current_period_start, current_period_end
FROM public.subscriptions;

\echo ''
\echo '========================================'
\echo '7. PLANS'
\echo '========================================'
SELECT id, name, price, billing_cycle, is_active FROM public.plans;

\echo ''
\echo '========================================'
\echo '8. CHECK TENANT SCHEMAS'
\echo '========================================'
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name LIKE 'tenant_%';
