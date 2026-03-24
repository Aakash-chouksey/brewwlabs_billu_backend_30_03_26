-- FINAL STANDARDIZATION MIGRATION: v1_final
-- Goal: Remove all 'brand' references and standardize on 'business_id'

BEGIN;

-- 1. Drop the brands table
DROP TABLE IF EXISTS brands CASCADE;

-- 2. Clean up tenant_connections table
ALTER TABLE tenant_connections DROP COLUMN IF EXISTS brand_id;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'SOLO';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
ALTER TABLE subscriptions DROP COLUMN IF EXISTS brand_id;

-- 3. Clean up users table
-- First, drop dependent indexes and constraints
DROP INDEX IF EXISTS idx_users_brand_id;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_brand_id_email_key;

-- Remove brand_id column
ALTER TABLE public.users DROP COLUMN IF EXISTS brand_id;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0;
ALTER TABLE public.super_admin_users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0;

-- Add new business-based unique constraint for users (if not already present)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_business_email_unique') THEN
        ALTER TABLE public.users ADD CONSTRAINT users_business_email_unique UNIQUE (business_id, email);
    END IF;
END $$;

-- 4. Ensure businesses table is clean
-- Remove owner_id if redundant or update it to be UUID
ALTER TABLE businesses ALTER COLUMN owner_id TYPE UUID USING owner_id::UUID;

-- 5. Standardize Tenant Tables (Example fixes for core tables)
-- This assumes all tables already have business_id, but ensures they are NOT NULL where missing
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name IN ('products', 'orders', 'order_items', 'inventory', 'payments', 'outlets')
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'business_id') THEN
            EXECUTE format('ALTER TABLE %I ALTER COLUMN business_id SET NOT NULL', t);
        ELSE
            RAISE NOTICE 'Table % does not have business_id column, skipping', t;
        END IF;
    END LOOP;
END $$;

COMMIT;
