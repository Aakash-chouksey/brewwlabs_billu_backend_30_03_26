-- Control Plane Database Setup
-- This script creates all necessary tables for the control plane database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Brands table (primary tenant identifier)
CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50),
    address TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Businesses table (tenant business records)
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50),
    address TEXT,
    owner_id UUID,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tenant Connections table (database connection info for each tenant)
CREATE TABLE IF NOT EXISTS tenant_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON UPDATE CASCADE ON DELETE CASCADE,
    business_id UUID REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE SET NULL,
    db_name VARCHAR(255) NOT NULL,
    db_host VARCHAR(255) NOT NULL,
    db_port INTEGER DEFAULT 5432,
    db_user VARCHAR(255) NOT NULL,
    encrypted_password TEXT NOT NULL,
    db_type VARCHAR(50) DEFAULT 'postgresql',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    ssl_mode VARCHAR(20) DEFAULT 'require',
    pool_size INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(brand_id)
);

-- Subscriptions table (tenant subscription management)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id) ON UPDATE CASCADE ON DELETE SET NULL,
    brand_id UUID REFERENCES brands(id) ON UPDATE CASCADE ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired', 'cancelled')),
    start_date DATE NOT NULL,
    end_date DATE,
    billing_cycle VARCHAR(20) DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
    auto_renew BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Plans table (subscription plans)
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    billing_cycle VARCHAR(20) DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
    features JSONB DEFAULT '{}',
    limits JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Super Admin Users table
CREATE TABLE IF NOT EXISTS super_admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) DEFAULT 'SUPER_ADMIN',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Cluster Metadata table (system configuration)
CREATE TABLE IF NOT EXISTS cluster_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) NOT NULL UNIQUE,
    value TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tenant Migration Log table
CREATE TABLE IF NOT EXISTS tenant_migration_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE SET NULL,
    brand_id UUID REFERENCES brands(id) ON UPDATE CASCADE ON DELETE SET NULL,
    migration_type VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs table (comprehensive audit logging)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    business_id UUID REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE SET NULL,
    brand_id UUID REFERENCES brands(id) ON UPDATE CASCADE ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    severity VARCHAR(20) DEFAULT 'LOW' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_brands_business_id ON brands(business_id);
CREATE INDEX IF NOT EXISTS idx_brands_status ON brands(status);
CREATE INDEX IF NOT EXISTS idx_brands_email ON brands(email);

CREATE INDEX IF NOT EXISTS idx_businesses_email ON businesses(email);
CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status);
CREATE INDEX IF NOT EXISTS idx_businesses_owner_id ON businesses(owner_id);

CREATE INDEX IF NOT EXISTS idx_tenant_connections_brand_id ON tenant_connections(brand_id);
CREATE INDEX IF NOT EXISTS idx_tenant_connections_business_id ON tenant_connections(business_id);
CREATE INDEX IF NOT EXISTS idx_tenant_connections_status ON tenant_connections(status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_business_id ON subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_brand_id ON subscriptions(brand_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_super_admin_users_email ON super_admin_users(email);
CREATE INDEX IF NOT EXISTS idx_super_admin_users_is_active ON super_admin_users(is_active);

CREATE INDEX IF NOT EXISTS idx_cluster_metadata_key ON cluster_metadata(key);

CREATE INDEX IF NOT EXISTS idx_tenant_migration_log_business_id ON tenant_migration_log(business_id);
CREATE INDEX IF NOT EXISTS idx_tenant_migration_log_brand_id ON tenant_migration_log(brand_id);
CREATE INDEX IF NOT EXISTS idx_tenant_migration_log_status ON tenant_migration_log(status);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_id ON audit_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_brand_id ON audit_logs(brand_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);

-- Insert default plans
INSERT INTO plans (name, description, price, billing_cycle, features, limits) VALUES
('Basic', 'Basic plan for small cafes', 0.00, 'monthly', '{"pos": true, "inventory": true, "reports": true}', '{"outlets": 1, "users": 3, "products": 100}'),
('Professional', 'Professional plan for growing businesses', 99.00, 'monthly', '{"pos": true, "inventory": true, "reports": true, "analytics": true, "api_access": true}', '{"outlets": 5, "users": 20, "products": 1000}'),
('Enterprise', 'Enterprise plan for large chains', 299.00, 'monthly', '{"pos": true, "inventory": true, "reports": true, "analytics": true, "api_access": true, "custom_integrations": true, "priority_support": true}', '{"outlets": 50, "users": 200, "products": 10000}'),
('Franchise', 'Franchise plan for multi-location businesses', 499.00, 'monthly', '{"pos": true, "inventory": true, "reports": true, "analytics": true, "api_access": true, "custom_integrations": true, "priority_support": true, "franchise_management": true}', '{"outlets": 200, "users": 1000, "products": 50000}')
ON CONFLICT (name) DO NOTHING;

-- Insert default super admin (password: admin123)
INSERT INTO super_admin_users (name, email, password_hash, role) VALUES
('Super Admin', 'admin@brewwlabs.com', '$2b$10$rQZ8kHWKQ/YgJ5zLzJ8Q/.J6qK4XhJ5J5J5J5J5J5J5J5J5J5J5J5J5J5J', 'SUPER_ADMIN')
ON CONFLICT (email) DO NOTHING;

-- Insert default cluster metadata
INSERT INTO cluster_metadata (key, value, description) VALUES
('system_version', '1.0.0', 'Current system version'),
('maintenance_mode', 'false', 'System maintenance mode flag'),
('max_tenants', '1000', 'Maximum number of tenants allowed'),
('default_plan_id', (SELECT id FROM plans WHERE name = 'Basic' LIMIT 1), 'Default subscription plan for new tenants')
ON CONFLICT (key) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON brands FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenant_connections_updated_at BEFORE UPDATE ON tenant_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_super_admin_users_updated_at BEFORE UPDATE ON super_admin_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cluster_metadata_updated_at BEFORE UPDATE ON cluster_metadata FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenant_migration_log_updated_at BEFORE UPDATE ON tenant_migration_log FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
