-- Control Plane Database Initialization
-- Contains only platform metadata for multi-tenant POS system

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Brands table with franchise hierarchy support
CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(32) NOT NULL DEFAULT 'SOLO' CHECK (type IN ('SOLO', 'MASTER_FRANCHISE', 'FRANCHISE', 'SUB_FRANCHISE')),
    parent_brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
    owner_user_id UUID NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive', 'suspended')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brands_parent_brand ON brands(parent_brand_id);
CREATE INDEX IF NOT EXISTS idx_brands_owner ON brands(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_brands_status ON brands(status);
CREATE INDEX IF NOT EXISTS idx_brands_type ON brands(type);

-- Tenant connections for database routing
CREATE TABLE IF NOT EXISTS tenant_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    cluster_id UUID REFERENCES cluster_metadata(id) ON DELETE SET NULL,
    db_host VARCHAR(255) NOT NULL,
    db_port INTEGER NOT NULL DEFAULT 5432,
    db_name VARCHAR(255) NOT NULL,
    db_user VARCHAR(255) NOT NULL,
    encrypted_password TEXT NOT NULL,
    migrated BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_connections_brand ON tenant_connections(brand_id);
CREATE INDEX IF NOT EXISTS idx_tenant_connections_cluster ON tenant_connections(cluster_id);
CREATE INDEX IF NOT EXISTS idx_tenant_connections_migrated ON tenant_connections(migrated);

-- Subscriptions for billing
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
    billing_cycle VARCHAR(32) NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly')),
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_brand ON subscriptions(brand_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Plans for subscription management
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    max_outlets INTEGER NOT NULL DEFAULT 1,
    max_users INTEGER NOT NULL DEFAULT 5,
    max_terminals INTEGER NOT NULL DEFAULT 1,
    features JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plans_active ON plans(is_active);
CREATE INDEX IF NOT EXISTS idx_plans_price ON plans(price);

-- Super admin users for platform management
CREATE TABLE IF NOT EXISTS super_admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(512) NOT NULL,
    role VARCHAR(64) NOT NULL DEFAULT 'SUPER_ADMIN',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_super_admin_users_email ON super_admin_users(email);

-- Cluster metadata for multi-database deployment
CREATE TABLE IF NOT EXISTS cluster_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cluster_name VARCHAR(255) NOT NULL UNIQUE,
    db_host VARCHAR(255) NOT NULL,
    db_port INTEGER NOT NULL DEFAULT 5432,
    max_tenants INTEGER NOT NULL DEFAULT 100,
    current_tenants INTEGER NOT NULL DEFAULT 0,
    region VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'full')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cluster_metadata_region ON cluster_metadata(region);
CREATE INDEX IF NOT EXISTS idx_cluster_metadata_status ON cluster_metadata(status);

-- Tenant migration log for tracking schema updates
CREATE TABLE IF NOT EXISTS tenant_migration_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    migration_version VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'failed')),
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_tenant_migration_log_brand ON tenant_migration_log(brand_id);
CREATE INDEX IF NOT EXISTS idx_tenant_migration_log_version ON tenant_migration_log(migration_version);
CREATE INDEX IF NOT EXISTS idx_tenant_migration_log_status ON tenant_migration_log(status);

-- Add comments for documentation
COMMENT ON TABLE brands IS 'Platform brands with franchise hierarchy support';
COMMENT ON COLUMN brands.type IS 'Franchise hierarchy type: SOLO, MASTER_FRANCHISE, FRANCHISE, SUB_FRANCHISE';
COMMENT ON COLUMN brands.parent_brand_id IS 'Parent brand for franchise hierarchy (self-referencing)';

COMMENT ON TABLE tenant_connections IS 'Database connection details for tenant routing';
COMMENT ON COLUMN tenant_connections.encrypted_password IS 'Encrypted database password for tenant database';

COMMENT ON TABLE subscriptions IS 'Subscription billing information for brands';
COMMENT ON TABLE plans IS 'Available subscription plans with feature limits';

COMMENT ON TABLE super_admin_users IS 'Platform administrator accounts';
COMMENT ON TABLE cluster_metadata IS 'Database cluster information for multi-cluster deployment';
COMMENT ON TABLE tenant_migration_log IS 'Migration history for tenant databases';

COMMIT;
