-- Control Plane DDL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS brands (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar(255) NOT NULL,
  email varchar(255) UNIQUE NOT NULL,
  phone varchar(255),
  address text,
  subscription_plan varchar(128) DEFAULT 'basic',
  subscription_expiresAt timestamptz,
  status varchar(32) NOT NULL DEFAULT 'pending',
  approvedBy uuid,
  approvedAt timestamptz,
  rejectionReason text,
  assignedCategories jsonb DEFAULT '[]',
  apiUsage integer DEFAULT 0,
  settings jsonb DEFAULT '{}',
  type varchar(32) NOT NULL DEFAULT 'SOLO' CHECK (type IN ('SOLO', 'MASTER_FRANCHISE', 'FRANCHISE', 'SUB_FRANCHISE')),
  parent_brand_id uuid REFERENCES brands(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brands_email ON brands(email);
CREATE INDEX IF NOT EXISTS idx_brands_status ON brands(status);
CREATE INDEX IF NOT EXISTS idx_brands_type ON brands(type);
CREATE INDEX IF NOT EXISTS idx_brands_parent_brand ON brands(parent_brand_id);

CREATE TABLE IF NOT EXISTS tenant_connections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id uuid NOT NULL,
  db_name varchar(255) NOT NULL,
  db_host varchar(255) NOT NULL,
  db_port integer DEFAULT 5432,
  db_user varchar(255) NOT NULL,
  encrypted_password text NOT NULL,
  cluster_id varchar(255),
  migrated boolean DEFAULT false,
  migration_status varchar(32) DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_connections_brand ON tenant_connections(brand_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  billing_status varchar(32),
  next_billing_date timestamptz,
  trial_ends_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_brand ON subscriptions(brand_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(billing_status);

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
  setup_fee decimal(10,2) DEFAULT 0.00,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plans_slug ON plans(slug);
CREATE INDEX IF NOT EXISTS idx_plans_active ON plans(is_active);
CREATE INDEX IF NOT EXISTS idx_plans_public ON plans(is_public);
CREATE INDEX IF NOT EXISTS idx_plans_price ON plans(price);
CREATE INDEX IF NOT EXISTS idx_plans_cycle ON plans(billing_cycle);

-- Add foreign key constraints for subscriptions
ALTER TABLE subscriptions 
ADD CONSTRAINT IF NOT EXISTS subscriptions_brand_id_fkey 
FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;

ALTER TABLE subscriptions 
ADD CONSTRAINT IF NOT EXISTS subscriptions_plan_id_fkey 
FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS super_admin_users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email varchar(255) UNIQUE NOT NULL,
  password_hash varchar(512) NOT NULL,
  role varchar(64) NOT NULL DEFAULT 'SUPER_ADMIN',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cluster_metadata (
  id varchar(255) PRIMARY KEY,
  provider varchar(128),
  region varchar(64),
  pgbouncer_endpoint varchar(512),
  capacity integer DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_migration_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id uuid NOT NULL,
  attempted_at timestamptz DEFAULT now(),
  status varchar(32) DEFAULT 'started',
  details jsonb
);
