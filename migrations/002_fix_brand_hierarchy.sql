-- Migration 002: Fix Brand Hierarchy and Rename businesses → brands
-- This migration safely renames the table and adds franchise hierarchy support

-- Step 1: Add franchise hierarchy columns to existing businesses table
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS type VARCHAR(32) DEFAULT 'SOLO',
ADD COLUMN IF NOT EXISTS parent_brand_id UUID REFERENCES businesses(id);

-- Add constraint for type enum
ALTER TABLE businesses 
ADD CONSTRAINT businesses_type_check 
CHECK (type IN ('SOLO', 'MASTER_FRANCHISE', 'FRANCHISE', 'SUB_FRANCHISE'));

-- Step 2: Create indexes for hierarchy queries
CREATE INDEX IF NOT EXISTS idx_businesses_parent_brand ON businesses(parent_brand_id);
CREATE INDEX IF NOT EXISTS idx_businesses_type ON businesses(type);

-- Step 3: Rename table from businesses to brands (safe approach)
-- First create the new brands table with proper structure
CREATE TABLE brands (
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
    type varchar(32) NOT NULL DEFAULT 'SOLO',
    parent_brand_id uuid REFERENCES brands(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add constraints for new table
ALTER TABLE brands 
ADD CONSTRAINT brands_type_check 
CHECK (type IN ('SOLO', 'MASTER_FRANCHISE', 'FRANCHISE', 'SUB_FRANCHISE'));

-- Step 4: Migrate data from businesses to brands
INSERT INTO brands (
    id, name, email, phone, address, subscription_plan, 
    subscription_expiresAt, status, approvedBy, approvedAt, 
    rejectionReason, assignedCategories, apiUsage, settings,
    type, parent_brand_id, created_at, updated_at
)
SELECT 
    id, name, email, phone, address, subscription_plan,
    subscription_expiresAt, status, approvedBy, approvedAt,
    rejectionReason, assignedCategories, apiUsage, settings,
    COALESCE(type, 'SOLO') as type,
    parent_brand_id,
    created_at, updated_at
FROM businesses;

-- Step 5: Update foreign key references
-- Update tenant_connections to reference brands instead of businesses
ALTER TABLE tenant_connections 
DROP CONSTRAINT IF EXISTS tenant_connections_brand_id_fkey;

ALTER TABLE tenant_connections 
ADD CONSTRAINT tenant_connections_brand_id_fkey 
FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;

-- Update subscriptions to reference brands instead of businesses
ALTER TABLE subscriptions 
DROP CONSTRAINT IF EXISTS subscriptions_brand_id_fkey;

ALTER TABLE subscriptions 
ADD CONSTRAINT subscriptions_brand_id_fkey 
FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;

-- Step 6: Create indexes for brands table
CREATE INDEX IF NOT EXISTS idx_brands_parent_brand ON brands(parent_brand_id);
CREATE INDEX IF NOT EXISTS idx_brands_type ON brands(type);
CREATE INDEX IF NOT EXISTS idx_brands_status ON brands(status);
CREATE INDEX IF NOT EXISTS idx_brands_email ON brands(email);

-- Step 7: Rename old table (keep as backup for safety)
ALTER TABLE businesses RENAME TO businesses_backup_20240305;

-- Step 8: Add comments for documentation
COMMENT ON TABLE brands IS 'Control plane table for brand/tenant management with franchise hierarchy support';
COMMENT ON COLUMN brands.type IS 'Franchise hierarchy type: SOLO, MASTER_FRANCHISE, FRANCHISE, SUB_FRANCHISE';
COMMENT ON COLUMN brands.parent_brand_id IS 'Parent brand for franchise hierarchy (self-referencing)';

COMMIT;
