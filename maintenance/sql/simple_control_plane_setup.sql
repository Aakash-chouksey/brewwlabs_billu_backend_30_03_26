-- Simple Control Plane Setup
-- Create essential tables for tenant connections

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

BEGIN;

-- Create businesses table first
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

-- Create tenant_connections table
CREATE TABLE IF NOT EXISTS tenant_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
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
    UNIQUE(business_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_businesses_email ON businesses(email);
CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status);
CREATE INDEX IF NOT EXISTS idx_tenant_connections_business_id ON tenant_connections(business_id);
CREATE INDEX IF NOT EXISTS idx_tenant_connections_status ON tenant_connections(status);

COMMIT;
