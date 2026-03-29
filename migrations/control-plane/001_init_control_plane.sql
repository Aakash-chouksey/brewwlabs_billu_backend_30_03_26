-- ==========================================
-- 🏗️ CONTROL PLANE INITIALIZATION (v1)
-- ==========================================
-- Target: public schema
-- This script aligns the database with Sequelize models
-- and enforces snake_case / business_id requirements.

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. PLANS TABLE
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- 3. BUSINESSES TABLE
CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50),
    gst_number VARCHAR(50),
    address TEXT,
    type VARCHAR(50) NOT NULL DEFAULT 'SOLO',
    owner_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    subscription_plan VARCHAR(50) DEFAULT 'free',
    business_id UUID REFERENCES public.businesses(id), -- self reference
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    outlet_id UUID,
    outlet_ids JSONB DEFAULT '[]',
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    panel_type VARCHAR(20) DEFAULT 'TENANT',
    status VARCHAR(20) DEFAULT 'active',
    salary DECIMAL(10,2),
    location TEXT,
    experience INTEGER,
    rating DECIMAL(3,2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    performance DECIMAL(5,2) DEFAULT 0,
    token_version INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT users_business_email_unique UNIQUE (business_id, email)
);

-- 5. TENANT REGISTRY (Crucial for schema mapping)
CREATE TABLE IF NOT EXISTS public.tenant_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
    schema_name VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) DEFAULT 'CREATING',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'trial',
    billing_cycle VARCHAR(50),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    brand_id UUID, -- Legacy reference kept for compatibility
    business_id UUID REFERENCES public.businesses(id),
    user_email VARCHAR(255),
    user_role VARCHAR(50),
    action_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    action_description TEXT,
    ip_address VARCHAR(50),
    user_agent TEXT,
    request_method VARCHAR(10),
    request_path VARCHAR(500),
    tenant_id UUID,
    severity_level VARCHAR(20) DEFAULT 'LOW',
    outcome VARCHAR(20) DEFAULT 'SUCCESS',
    metadata JSONB DEFAULT '{}',
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. SCHEMA VERSIONS (Migration tracking for public)
CREATE TABLE IF NOT EXISTS public.schema_versions (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. CLUSTER METADATA (Optional but recommended)
CREATE TABLE IF NOT EXISTS public.cluster_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    db_host VARCHAR(255) NOT NULL,
    db_port INTEGER DEFAULT 5432,
    status VARCHAR(50) DEFAULT 'active'
);

-- 10. SUPER ADMIN USERS
CREATE TABLE IF NOT EXISTS public.super_admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(512) NOT NULL,
    role VARCHAR(64) NOT NULL DEFAULT 'SUPER_ADMIN',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. TENANT MIGRATION LOG
CREATE TABLE IF NOT EXISTS public.tenant_migration_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    migration_version VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'failed')),
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    error_message TEXT
);

-- 12. TENANT CONNECTIONS
CREATE TABLE IF NOT EXISTS public.tenant_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
    db_host VARCHAR(255) NOT NULL,
    db_port INTEGER DEFAULT 5432,
    db_name VARCHAR(255) NOT NULL,
    db_user VARCHAR(255) NOT NULL,
    encrypted_password TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_businesses_email ON public.businesses(email);
CREATE INDEX IF NOT EXISTS idx_users_business_id ON public.users(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_business ON public.audit_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- INITIAL SEED (Free Plan)
INSERT INTO public.plans (name, price, max_outlets, max_users, max_terminals, is_active)
VALUES ('Enterprise', 0.00, 100, 1000, 100, TRUE)
ON CONFLICT (name) DO NOTHING;
