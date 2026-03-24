-- 003_control_plane_refactor.sql
-- Goal: Rename businesses to brands, implement hierarchy, and setup plans.

BEGIN;

-- 1. Rename businesses table to brands if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'businesses') THEN
        ALTER TABLE businesses RENAME TO brands;
    END IF;
END $$;

-- 2. Add hierarchy fields to brands if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'type') THEN
        ALTER TABLE brands ADD COLUMN type VARCHAR(32) DEFAULT 'SOLO' CHECK (type IN ('SOLO', 'MASTER_FRANCHISE', 'FRANCHISE', 'SUB_FRANCHISE'));
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'brands' AND column_name = 'parent_brand_id') THEN
        ALTER TABLE brands ADD COLUMN parent_brand_id UUID REFERENCES brands(id);
        CREATE INDEX idx_brands_parent_brand ON brands(parent_brand_id);
    END IF;
END $$;

-- 3. Create plans table if it doesn't exist
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar(255) NOT NULL,
  slug varchar(255) UNIQUE NOT NULL,
  description text,
  price decimal(10,2) NOT NULL DEFAULT 0.00,
  billing_cycle varchar(32) NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly')),
  features jsonb DEFAULT '[]',
  limits jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  is_public boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  trial_days integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Create subscriptions table if it doesn't exist
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  billing_status varchar(32),
  next_billing_date timestamptz,
  trial_ends_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Ensure tenant_connections.brand_id references brands.id (handled by RENAME)
-- Update indexes
CREATE INDEX IF NOT EXISTS idx_plans_slug ON plans(slug);
CREATE INDEX IF NOT EXISTS idx_subscriptions_brand ON subscriptions(brand_id);

COMMIT;
