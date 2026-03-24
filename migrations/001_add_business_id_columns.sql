-- Migration: Add business_id columns to all tenant tables
-- This migration adds business_id fields to ensure proper tenant isolation

-- Add business_id to tables that are missing it
ALTER TABLE partners ADD COLUMN business_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE partner_memberships ADD COLUMN business_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE partner_wallets ADD COLUMN business_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE web_contents ADD COLUMN business_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_partners_business_id ON partners(business_id);
CREATE INDEX IF NOT EXISTS idx_partner_memberships_business_id ON partner_memberships(business_id);
CREATE INDEX IF NOT EXISTS idx_partner_wallets_business_id ON partner_wallets(business_id);
CREATE INDEX IF NOT EXISTS idx_web_contents_business_id ON web_contents(business_id);

-- Add outlet_id to web_contents if not exists
ALTER TABLE web_contents ADD COLUMN IF NOT EXISTS outlet_id UUID;
CREATE INDEX IF NOT EXISTS idx_web_contents_outlet_id ON web_contents(outlet_id);

-- Update unique constraints to include business_id
-- Drop old unique constraints if they exist
ALTER TABLE partners DROP CONSTRAINT IF EXISTS partners_name_key;
ALTER TABLE partner_memberships DROP CONSTRAINT IF EXISTS partner_memberships_partner_type_id_partner_id_key;
ALTER TABLE web_contents DROP CONSTRAINT IF EXISTS web_contents_page_key;

-- Add new unique constraints with business_id
ALTER TABLE partners ADD CONSTRAINT partners_business_name_unique UNIQUE (business_id, name);
ALTER TABLE partner_memberships ADD CONSTRAINT partner_memberships_business_unique UNIQUE (business_id, partner_type_id, partner_id);
ALTER TABLE web_contents ADD CONSTRAINT web_contents_business_page_unique UNIQUE (business_id, page);

-- Set default values to NULL for proper tenant isolation
-- (The default above was just to allow the column addition, now we'll update)
-- This would typically be done in a separate data migration step
