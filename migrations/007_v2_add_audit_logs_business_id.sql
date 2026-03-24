-- Migration: Add business_id column to audit_logs table
-- Fixes the missing business_id column error in audit log insertions

BEGIN;

-- Add business_id column to audit_logs table
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS business_id UUID;

-- Add foreign key constraint to brands table
-- First drop if exists to ensure idempotency
ALTER TABLE audit_logs 
DROP CONSTRAINT IF EXISTS audit_logs_business_id_fkey;

ALTER TABLE audit_logs 
ADD CONSTRAINT audit_logs_business_id_fkey 
FOREIGN KEY (business_id) 
REFERENCES brands(id) 
ON DELETE SET NULL;

-- Add index for business_id for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_id_new 
ON audit_logs(business_id);

-- Add comment to the new column
COMMENT ON COLUMN audit_logs.business_id IS 'Business/tenant context for the audit action';

-- Update existing audit logs that don't have business_id set
UPDATE audit_logs 
SET business_id = COALESCE(brand_id, tenant_id)
WHERE business_id IS NULL 
AND (brand_id IS NOT NULL OR tenant_id IS NOT NULL);

-- Create composite index for better query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_created 
ON audit_logs(business_id, created_at);

COMMIT;
