-- Migration: Add order enhancements for complex order support
-- File: migrations/011_add_order_enhancements.sql
-- Purpose: Add JSONB fields and additional columns to support complex order data

-- Add items field as JSONB to store order items array
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- Add billing field as JSONB to store complex billing information
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing JSONB;

-- Add idempotency key for preventing duplicate orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);

-- Add order status field for more granular status tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_status VARCHAR(50) DEFAULT 'CREATED';

-- Add customer_id field for explicit customer relationship
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id UUID;

-- Add indexes for performance on JSONB fields
CREATE INDEX IF NOT EXISTS idx_orders_items ON orders USING GIN (items);
CREATE INDEX IF NOT EXISTS idx_orders_billing ON orders USING GIN (billing);
CREATE INDEX IF NOT EXISTS idx_orders_idempotency ON orders (idempotency_key);

-- Add foreign key constraint for customer_id if customer table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_orders_customer_id'
        AND table_name = 'orders'
    ) THEN
        -- Constraint already exists, skip
    ELSE
        -- Add foreign key constraint
        ALTER TABLE orders 
        ADD CONSTRAINT fk_orders_customer_id 
        FOREIGN KEY (customer_id) 
        REFERENCES customers(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN orders.items IS 'JSON array of order items with product details, quantities, and prices';
COMMENT ON COLUMN orders.billing IS 'JSON object containing billing details like discount, payment method, tax calculations';
COMMENT ON COLUMN orders.idempotency_key IS 'Unique key to prevent duplicate order submissions';
COMMENT ON COLUMN orders.order_status IS 'Detailed order status for workflow tracking (CREATED, CONFIRMED, PREPARING, etc.)';
COMMENT ON COLUMN orders.customer_id IS 'Reference to customer record for loyalty and tracking';

-- Update existing records to ensure backward compatibility
UPDATE orders 
SET 
    items = COALESCE(items, '[]'::jsonb),
    order_status = COALESCE(order_status, status)
WHERE items IS NULL OR order_status IS NULL;

-- Create a trigger to maintain backward compatibility if needed
CREATE OR REPLACE FUNCTION update_order_status()
RETURNS TRIGGER AS $$
BEGIN
    -- If order_status is updated, also update the legacy status field
    IF NEW.order_status IS DISTINCT FROM OLD.order_status THEN
        NEW.status = NEW.order_status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to sync status fields
DROP TRIGGER IF EXISTS trigger_update_order_status ON orders;
CREATE TRIGGER trigger_update_order_status
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_order_status();

-- Log migration completion
DO $$
BEGIN
    INSERT INTO tenant_migration_log (migration_name, status, executed_at, details)
    VALUES (
        '011_add_order_enhancements.sql', 
        'COMPLETED', 
        NOW(), 
        'Added items JSONB, billing JSONB, idempotency_key, order_status, customer_id fields with indexes and constraints'
    )
    ON CONFLICT (migration_name) 
    DO UPDATE SET 
        status = 'COMPLETED', 
        executed_at = NOW(), 
        details = EXCLUDED.details;
END $$;
