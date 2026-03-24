-- Migration: Create audit_logs table in control plane database
-- This table stores comprehensive audit logs for security and compliance

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User tracking
    user_id UUID,
    user_email VARCHAR(255),
    user_role VARCHAR(50),
    
    -- Action details
    action_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    action_description TEXT,
    
    -- Request context
    ip_address INET,
    user_agent TEXT,
    request_method VARCHAR(10),
    request_path VARCHAR(500),
    
    -- Tenant context (if applicable)
    tenant_id UUID,
    brand_id UUID,
    
    -- Severity and outcome
    severity_level VARCHAR(20) DEFAULT 'LOW' CHECK (severity_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    outcome VARCHAR(20) DEFAULT 'SUCCESS' CHECK (outcome IN ('SUCCESS', 'FAILURE', 'ERROR')),
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    old_values JSONB,
    new_values JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for performance
    CONSTRAINT audit_logs_user_id_check CHECK (user_id IS NOT NULL OR user_email IS NOT NULL)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_email ON audit_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity_level ON audit_logs(severity_level);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_brand_id ON audit_logs(brand_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_action ON audit_logs(tenant_id, action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity_created ON audit_logs(severity_level, created_at);

-- Add table comment
COMMENT ON TABLE audit_logs IS 'Comprehensive audit logging for security and compliance';
COMMENT ON COLUMN audit_logs.action_type IS 'Type of action performed (e.g., LOGIN, LOGOUT, CREATE, UPDATE, DELETE)';
COMMENT ON COLUMN audit_logs.severity_level IS 'Security severity level (LOW, MEDIUM, HIGH, CRITICAL)';
COMMENT ON COLUMN audit_logs.outcome IS 'Result of the action (SUCCESS, FAILURE, ERROR)';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional context data in JSON format';
COMMENT ON COLUMN audit_logs.old_values IS 'Previous entity values before update';
COMMENT ON COLUMN audit_logs.new_values IS 'New entity values after update';
