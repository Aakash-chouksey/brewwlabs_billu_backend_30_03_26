-- 006_fix_subscription_plan_collision.sql
-- Fix naming collision and schema on subscriptions table

DO $$ 
BEGIN
    -- Only run migration if the table actually exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
        
        -- 1. Rename brandId to brand_id if it exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'brandId') THEN
            ALTER TABLE subscriptions RENAME COLUMN "brandId" TO brand_id;
        END IF;

        -- 2. Handle plan to plan_id conversion
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'plan') THEN
            ALTER TABLE subscriptions ADD COLUMN plan_id UUID;
            ALTER TABLE subscriptions DROP COLUMN plan;
        END IF;

        -- 3. Rename billing_status to status
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'billing_status') THEN
            ALTER TABLE subscriptions RENAME COLUMN billing_status TO status;
        END IF;

        -- 4. Add billing_cycle
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'billing_cycle') THEN
            ALTER TABLE subscriptions ADD COLUMN billing_cycle VARCHAR;
        END IF;

        -- 5. Add current_period_start
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'current_period_start') THEN
            ALTER TABLE subscriptions ADD COLUMN current_period_start TIMESTAMP;
        END IF;

        -- 6. Rename next_billing_date to current_period_end
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'next_billing_date') THEN
            ALTER TABLE subscriptions RENAME COLUMN next_billing_date TO current_period_end;
        END IF;
        
        -- Ensure current_period_end exists in case next_billing_date didn't
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'current_period_end') THEN
            ALTER TABLE subscriptions ADD COLUMN current_period_end TIMESTAMP;
        END IF;
        
    END IF;
END $$;
