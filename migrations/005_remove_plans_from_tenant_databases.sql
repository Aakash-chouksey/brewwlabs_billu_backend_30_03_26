-- Migration 005: Remove plans table from tenant databases
-- Plans should only exist in control plane database

-- Step 1: Check if plans table exists in tenant database
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plans' AND table_schema = 'public') THEN
        -- Step 2: Backup existing plans data (optional - for safety)
        CREATE TABLE IF NOT EXISTS plans_backup_20240305 AS 
        SELECT * FROM plans;
        
        -- Step 3: Drop the plans table from tenant database
        DROP TABLE IF EXISTS plans CASCADE;
        
        RAISE NOTICE 'Plans table removed from tenant database. Data backed up to plans_backup_20240305';
    ELSE
        RAISE NOTICE 'Plans table does not exist in tenant database';
    END IF;
END $$;

-- Step 4: Remove any foreign key constraints that reference plans
DO $$
BEGIN
    -- Drop any constraints that might reference the plans table
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'subscriptions_plan_id_fkey' 
               AND table_schema = 'public') THEN
        ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_plan_id_fkey;
        RAISE NOTICE 'Dropped subscriptions_plan_id_fkey constraint';
    END IF;
END $$;

-- Step 5: Update subscriptions table to remove plan_id if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE column_name = 'plan_id' 
               AND table_name = 'subscriptions' 
               AND table_schema = 'public') THEN
        -- Update subscriptions to store plan name instead of ID for reference
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_name VARCHAR(255);
        
        -- Update plan_name from plans table before dropping
        UPDATE subscriptions 
        SET plan_name = (SELECT name FROM plans WHERE plans.id = subscriptions.plan_id)
        WHERE plan_id IS NOT NULL;
        
        -- Drop the plan_id column
        ALTER TABLE subscriptions DROP COLUMN IF EXISTS plan_id;
        
        RAISE NOTICE 'Updated subscriptions table to remove plan_id reference';
    END IF;
END $$;

-- Step 6: Add comments
COMMENT ON COLUMN subscriptions.plan_name IS 'Plan name reference (plans are managed in control plane database)';

COMMIT;
