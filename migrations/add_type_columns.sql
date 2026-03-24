-- Add missing type columns to accounts and transactions tables

DO $$
BEGIN
    -- Add type column to accounts table if it exists and column doesn't exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts') AND
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'type') THEN
        ALTER TABLE accounts ADD COLUMN type VARCHAR(20) DEFAULT 'Cash';
        RAISE NOTICE 'Added type column to accounts table';
    END IF;
    
    -- Add type column to transactions table if it exists and column doesn't exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') AND
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'type') THEN
        ALTER TABLE transactions ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'credit';
        RAISE NOTICE 'Added type column to transactions table';
    END IF;
END $$;

-- Add constraints for type columns
DO $$
BEGIN
    -- Add check constraint for accounts type if table exists and constraint doesn't exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts') AND
       NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE table_name = 'accounts' AND constraint_name = 'check_account_type') THEN
        ALTER TABLE accounts ADD CONSTRAINT check_account_type 
        CHECK (type IN ('Cash', 'Bank', 'Digital', 'Other'));
        RAISE NOTICE 'Added check constraint for accounts type';
    END IF;
    
    -- Add check constraint for transactions type if table exists and constraint doesn't exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') AND
       NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE table_name = 'transactions' AND constraint_name = 'check_transaction_type') THEN
        ALTER TABLE transactions ADD CONSTRAINT check_transaction_type 
        CHECK (type IN ('credit', 'debit'));
        RAISE NOTICE 'Added check constraint for transactions type';
    END IF;
END $$;

-- Add indexes for performance (only if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts') THEN
        CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') THEN
        CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    END IF;
END $$;

-- Update table statistics (only if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts') THEN
        ANALYZE accounts;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') THEN
        ANALYZE transactions;
    END IF;
END $$;
