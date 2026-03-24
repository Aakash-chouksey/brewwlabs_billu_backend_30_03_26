-- Migration 004: Fix User Outlet Mapping
-- Convert JSONB outletIds to proper relational user_outlets mapping table

-- Step 1: Add primary_outlet_id column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS primary_outlet_id UUID REFERENCES outlets(id);

-- Step 2: Create user_outlets mapping table
CREATE TABLE IF NOT EXISTS user_outlets (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL,
    outlet_id uuid NOT NULL,
    assigned_at timestamptz DEFAULT now(),
    assigned_by uuid REFERENCES users(id),
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, outlet_id)
);

-- Step 3: Create indexes for user_outlets table
CREATE INDEX IF NOT EXISTS idx_user_outlets_user ON user_outlets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_outlets_outlet ON user_outlets(outlet_id);
CREATE INDEX IF NOT EXISTS idx_user_outlets_active ON user_outlets(user_id, is_active);

-- Step 4: Migrate data from JSONB outletIds to user_outlets table
-- First, set primary outlet for users who have outletIds
UPDATE users 
SET primary_outlet_id = (
    CASE 
        WHEN outletIds IS NOT NULL 
        AND jsonb_array_length(outletIds) > 0 
        THEN (outletIds->>0)::uuid
        ELSE NULL
    END
)
WHERE outletIds IS NOT NULL 
AND jsonb_array_length(outletIds) > 0;

-- Then, migrate all outletIds to user_outlets mapping table
INSERT INTO user_outlets (user_id, outlet_id, assigned_at)
SELECT 
    u.id as user_id,
    outlet_elem.value::uuid as outlet_id,
    u.created_at as assigned_at
FROM users u,
    jsonb_array_elements(u.outletIds) as outlet_elem
WHERE u.outletIds IS NOT NULL
AND jsonb_array_length(u.outletIds) > 0
ON CONFLICT (user_id, outlet_id) DO NOTHING;

-- Step 5: Create foreign key constraints for user_outlets
ALTER TABLE user_outlets 
ADD CONSTRAINT IF NOT EXISTS user_outlets_user_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE user_outlets 
ADD CONSTRAINT IF NOT EXISTS user_outlets_outlet_fkey 
FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE CASCADE;

ALTER TABLE user_outlets 
ADD CONSTRAINT IF NOT EXISTS user_outlets_assigned_by_fkey 
FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL;

-- Step 6: Add foreign key constraint for primary_outlet_id
ALTER TABLE users 
ADD CONSTRAINT IF NOT EXISTS users_primary_outlet_fkey 
FOREIGN KEY (primary_outlet_id) REFERENCES outlets(id) ON DELETE SET NULL;

-- Step 7: Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_primary_outlet ON users(primary_outlet_id);
CREATE INDEX IF NOT EXISTS idx_users_business_primary_outlet ON users(businessId, primary_outlet_id);

-- Step 8: Drop the old outletIds column (after verifying migration)
-- ALTER TABLE users DROP COLUMN IF EXISTS outletIds;

-- Step 9: Add comments for documentation
COMMENT ON COLUMN users.primary_outlet_id IS 'Primary outlet for this user';
COMMENT ON TABLE user_outlets IS 'Mapping table for user outlet permissions and assignments';
COMMENT ON COLUMN user_outlets.assigned_by IS 'User who granted this outlet access';
COMMENT ON COLUMN user_outlets.is_active IS 'Whether this outlet assignment is currently active';

-- Step 10: Create a view for easier querying
CREATE OR REPLACE VIEW user_outlet_details AS
SELECT 
    u.id as user_id,
    u.name as user_name,
    u.email as user_email,
    u.role as user_role,
    u.businessId,
    u.primary_outlet_id,
    o.id as outlet_id,
    o.name as outlet_name,
    uo.is_active as outlet_access_active,
    uo.assigned_at,
    uo.updated_at
FROM users u
LEFT JOIN user_outlets uo ON u.id = uo.user_id AND uo.is_active = true
LEFT JOIN outlets o ON uo.outlet_id = o.id
WHERE u.isActive = true;

COMMIT;
