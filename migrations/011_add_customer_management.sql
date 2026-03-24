-- Migration: Add Customer Management Tables
-- This migration adds customer, customer_transactions, and customer_ledger tables
-- Also adds customer_id to orders table

-- Add customer_id to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL,
    outlet_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    total_due DECIMAL(10,2) DEFAULT 0.00,
    total_paid DECIMAL(10,2) DEFAULT 0.00,
    last_visit_at TIMESTAMP,
    visit_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create customer_transactions table
CREATE TABLE IF NOT EXISTS customer_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL,
    outlet_id UUID NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('PAYMENT', 'DUE', 'REFUND')),
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(20) CHECK (payment_method IN ('CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'OTHER')),
    description TEXT,
    transaction_date TIMESTAMP NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create customer_ledger table
CREATE TABLE IF NOT EXISTS customer_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL,
    outlet_id UUID NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES customer_transactions(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT')),
    amount DECIMAL(10,2) NOT NULL,
    description TEXT NOT NULL,
    balance_before DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    entry_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for customers table
CREATE INDEX IF NOT EXISTS idx_customers_brand_id ON customers(brand_id);
CREATE INDEX IF NOT EXISTS idx_customers_brand_outlet ON customers(brand_id, outlet_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_brand_outlet_phone ON customers(brand_id, outlet_id, phone);
CREATE INDEX IF NOT EXISTS idx_customers_brand_outlet_name ON customers(brand_id, outlet_id, name);

-- Create indexes for customer_transactions table
CREATE INDEX IF NOT EXISTS idx_customer_transactions_brand_id ON customer_transactions(brand_id);
CREATE INDEX IF NOT EXISTS idx_customer_transactions_brand_outlet ON customer_transactions(brand_id, outlet_id);
CREATE INDEX IF NOT EXISTS idx_customer_transactions_customer_id ON customer_transactions(brand_id, outlet_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_transactions_date ON customer_transactions(brand_id, outlet_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_customer_transactions_type ON customer_transactions(brand_id, outlet_id, transaction_type);

-- Create indexes for customer_ledger table
CREATE INDEX IF NOT EXISTS idx_customer_ledger_brand_id ON customer_ledger(brand_id);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_brand_outlet ON customer_ledger(brand_id, outlet_id);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer_id ON customer_ledger(brand_id, outlet_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer_date ON customer_ledger(brand_id, outlet_id, customer_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_transaction_id ON customer_ledger(brand_id, outlet_id, transaction_id);

-- Create index for orders.customer_id
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- Add comments for documentation
COMMENT ON TABLE customers IS 'Stores customer information including contact details and financial summaries';
COMMENT ON TABLE customer_transactions IS 'Records all financial transactions for customers (payments, dues, refunds)';
COMMENT ON TABLE customer_ledger IS 'Maintains a complete ledger of all customer financial activities';

COMMENT ON COLUMN customers.total_due IS 'Total amount owed by the customer';
COMMENT ON COLUMN customers.total_paid IS 'Total amount paid by the customer';
COMMENT ON COLUMN customers.visit_count IS 'Number of times the customer has visited';
COMMENT ON COLUMN customer_transactions.transaction_type IS 'Type of transaction: PAYMENT, DUE, or REFUND';
COMMENT ON COLUMN customer_transactions.payment_method IS 'Payment method used: CASH, CARD, UPI, BANK_TRANSFER, or OTHER';
COMMENT ON COLUMN customer_ledger.entry_type IS 'Ledger entry type: DEBIT (increases due) or CREDIT (decreases due)';
COMMENT ON COLUMN customer_ledger.balance_before IS 'Customer balance before this transaction';
COMMENT ON COLUMN customer_ledger.balance_after IS 'Customer balance after this transaction';

-- Create trigger to update updated_at timestamp for customers
CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_customers_updated_at();

-- Create trigger to update updated_at timestamp for customer_transactions
CREATE OR REPLACE FUNCTION update_customer_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_customer_transactions_updated_at
    BEFORE UPDATE ON customer_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_transactions_updated_at();

-- Create trigger to update updated_at timestamp for customer_ledger
CREATE OR REPLACE FUNCTION update_customer_ledger_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_customer_ledger_updated_at
    BEFORE UPDATE ON customer_ledger
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_ledger_updated_at();
