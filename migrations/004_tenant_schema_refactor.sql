-- 004_tenant_schema_refactor.sql
-- Goal: Implement outlet scoping for products/categories and refactor user mapping.

BEGIN;

-- 1. Add primary_outlet_id to users
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'primary_outlet_id') THEN
        ALTER TABLE users ADD COLUMN primary_outlet_id UUID;
        CREATE INDEX idx_users_primary_outlet ON users(primary_outlet_id);
    END IF;
END $$;

-- 2. Create user_outlets mapping table
CREATE TABLE IF NOT EXISTS user_outlets (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    outlet_id uuid NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    assigned_by uuid,
    is_active boolean DEFAULT true,
    assigned_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, outlet_id)
);

-- 3. Data Migration: Convert JSONB outletIds to user_outlets entries
-- This assumes the original column was called 'outletIds' or similar JSONB
-- Since we are moving from JSONB -> user_outlets, we need to extract and insert.
-- Note: 'outletIds' is NOT in the new Sequelize model, so we must do it now.

DO $$
DECLARE
    u_row RECORD;
    o_id UUID;
BEGIN
    -- Check if outletIds column exists before trying to migrate
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'outletIds') THEN
        FOR u_row IN SELECT id, "outletIds" FROM users WHERE "outletIds" IS NOT NULL AND jsonb_array_length("outletIds") > 0 LOOP
            -- Set primary_outlet_id to the first one in the list
            UPDATE users SET primary_outlet_id = (u_row."outletIds"->>0)::uuid WHERE id = u_row.id;
            
            -- Insert all into user_outlets
            FOR o_id IN SELECT jsonb_array_elements_text(u_row."outletIds")::uuid LOOP
                INSERT INTO user_outlets (user_id, outlet_id) 
                VALUES (u_row.id, o_id)
                ON CONFLICT (user_id, outlet_id) DO NOTHING;
            END LOOP;
        END LOOP;
        
        -- Optional: Drop the old column after validation if desired, 
        -- but rule says "Never drop production tables", doesn't explicitly forbid dropping columns.
        -- We'll keep it for safety unless told otherwise.
    END IF;
END $$;

-- 4. Scope Categories and Products to Outlet
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'outletId') THEN
        ALTER TABLE categories ADD COLUMN outletId UUID;
        CREATE INDEX idx_categories_outlet ON categories(outletId);
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'outletId') THEN
        ALTER TABLE products ADD COLUMN outletId UUID;
        CREATE INDEX idx_products_outlet ON products(outletId);
    END IF;
END $$;

-- 5. Backfill outletId for existing categories/products
-- Simple heuristic: assign to the first active outlet of the business
UPDATE categories c
SET outletId = (SELECT id FROM outlets WHERE "businessId" = c."businessId" LIMIT 1)
WHERE outletId IS NULL;

UPDATE products p
SET outletId = (SELECT id FROM outlets WHERE "businessId" = p."businessId" LIMIT 1)
WHERE outletId IS NULL;

-- 6. Enforce NOT NULL if backfill was successful
-- ALTER TABLE categories ALTER COLUMN outletId SET NOT NULL;
-- ALTER TABLE products ALTER COLUMN outletId SET NOT NULL;

COMMIT;
