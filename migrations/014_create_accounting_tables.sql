-- Create Accounting Tables Migration
-- This migration creates the missing accounting tables with proper schema

-- Create Accounts table
CREATE TABLE IF NOT EXISTS "Accounts" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'Cash',
    balance DECIMAL(10,2) DEFAULT 0,
    "businessId" UUID NOT NULL,
    "outletId" UUID NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Transactions table
CREATE TABLE IF NOT EXISTS "Transactions" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    category VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    "accountId" UUID NOT NULL,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "businessId" UUID NOT NULL,
    "outletId" UUID NOT NULL,
    "performedBy" UUID,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for Accounts table
CREATE INDEX IF NOT EXISTS "Accounts_business_idx" ON "Accounts" ("businessId");
CREATE INDEX IF NOT EXISTS "Accounts_outlet_idx" ON "Accounts" ("outletId");
CREATE INDEX IF NOT EXISTS "Accounts_business_outlet_idx" ON "Accounts" ("businessId", "outletId");
CREATE INDEX IF NOT EXISTS "Accounts_name_idx" ON "Accounts" ("name");

-- Create indexes for Transactions table
CREATE INDEX IF NOT EXISTS "Transactions_business_idx" ON "Transactions" ("businessId");
CREATE INDEX IF NOT EXISTS "Transactions_outlet_idx" ON "Transactions" ("outletId");
CREATE INDEX IF NOT EXISTS "Transactions_business_outlet_idx" ON "Transactions" ("businessId", "outletId");
CREATE INDEX IF NOT EXISTS "Transactions_account_idx" ON "Transactions" ("accountId");
CREATE INDEX IF NOT EXISTS "Transactions_date_idx" ON "Transactions" ("date");
CREATE INDEX IF NOT EXISTS "Transactions_type_idx" ON "Transactions" ("type");

-- Add foreign key constraints if the referenced tables exist
DO $$
BEGIN
    -- Check if brands table exists and add foreign key
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Brands') THEN
        ALTER TABLE "Accounts" ADD CONSTRAINT "Accounts_business_fkey" 
        FOREIGN KEY ("businessId") REFERENCES "Brands" ("id") ON DELETE CASCADE;
        
        ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_business_fkey" 
        FOREIGN KEY ("businessId") REFERENCES "Brands" ("id") ON DELETE CASCADE;
    END IF;
    
    -- Check if outlets table exists and add foreign key
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Outlets') THEN
        ALTER TABLE "Accounts" ADD CONSTRAINT "Accounts_outlet_fkey" 
        FOREIGN KEY ("outletId") REFERENCES "Outlets" ("id") ON DELETE CASCADE;
        
        ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_outlet_fkey" 
        FOREIGN KEY ("outletId") REFERENCES "Outlets" ("id") ON DELETE CASCADE;
    END IF;
    
    -- Add self-referencing foreign key for transactions
    ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_account_fkey" 
    FOREIGN KEY ("accountId") REFERENCES "Accounts" ("id") ON DELETE CASCADE;
    
    -- Check if users table exists and add foreign key
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_user_fkey" 
        FOREIGN KEY ("performedBy") REFERENCES "users" ("id") ON DELETE SET NULL;
    END IF;
END $$;

-- Create update timestamp trigger for Accounts
CREATE OR REPLACE FUNCTION update_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_accounts_updated_at 
    BEFORE UPDATE ON "Accounts" 
    FOR EACH ROW EXECUTE FUNCTION update_accounts_updated_at();

-- Create update timestamp trigger for Transactions
CREATE OR REPLACE FUNCTION update_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_transactions_updated_at 
    BEFORE UPDATE ON "Transactions" 
    FOR EACH ROW EXECUTE FUNCTION update_transactions_updated_at();

-- Insert default accounts for existing tenants (optional)
-- This will only work if there are existing tenants
INSERT INTO "Accounts" (name, type, balance, "businessId", "outletId")
SELECT 
    'Cash Account',
    'Cash',
    0,
    business_id,
    outlet_id
FROM (
    SELECT DISTINCT business_id, outlet_id 
    FROM outlets 
    LIMIT 1
) existing_outlets
WHERE NOT EXISTS (
    SELECT 1 FROM "Accounts" 
    WHERE "businessId" = existing_outlets.business_id 
    AND "outletId" = existing_outlets.outlet_id
    AND name = 'Cash Account'
)
LIMIT 1;

INSERT INTO "Accounts" (name, type, balance, "businessId", "outletId")
SELECT 
    'Bank Account',
    'Bank',
    0,
    business_id,
    outlet_id
FROM (
    SELECT DISTINCT business_id, outlet_id 
    FROM outlets 
    LIMIT 1
) existing_outlets
WHERE NOT EXISTS (
    SELECT 1 FROM "Accounts" 
    WHERE "businessId" = existing_outlets.business_id 
    AND "outletId" = existing_outlets.outlet_id
    AND name = 'Bank Account'
)
LIMIT 1;

-- Add comments for documentation
COMMENT ON TABLE "Accounts" IS 'Account records for tracking financial accounts per business and outlet';
COMMENT ON TABLE "Transactions" IS 'Financial transactions记录 for income and expenses per business and outlet';
