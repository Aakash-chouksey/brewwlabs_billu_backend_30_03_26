-- Create expense_types table
CREATE TABLE IF NOT EXISTS expense_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL,
    outlet_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(500),
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_expense_types_brand_outlet ON expense_types(brand_id, outlet_id);
CREATE INDEX IF NOT EXISTS idx_expense_types_name ON expense_types(name);
CREATE INDEX IF NOT EXISTS idx_expense_types_enabled ON expense_types(is_enabled);

-- Add foreign key constraints if brands and outlets tables exist
-- (These may fail if the tables don't exist, which is fine for now)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'brands') THEN
        ALTER TABLE expense_types ADD CONSTRAINT fk_expense_types_brand 
        FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'outlets') THEN
        ALTER TABLE expense_types ADD CONSTRAINT fk_expense_types_outlet 
        FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_expense_types_updated_at 
    BEFORE UPDATE ON expense_types 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default expense types for existing tenants (optional)
-- This will only work if there are existing tenants
INSERT INTO expense_types (brand_id, outlet_id, name, description)
SELECT 
    brand_id, 
    outlet_id, 
    'Utilities',
    'Electricity, water, internet, and other utility expenses'
FROM (
    SELECT DISTINCT brand_id, outlet_id 
    FROM outlets 
    LIMIT 1
) existing_outlets
WHERE NOT EXISTS (
    SELECT 1 FROM expense_types 
    WHERE brand_id = existing_outlets.brand_id 
    AND outlet_id = existing_outlets.outlet_id
    AND name = 'Utilities'
)
LIMIT 1;

INSERT INTO expense_types (brand_id, outlet_id, name, description)
SELECT 
    brand_id, 
    outlet_id, 
    'Rent',
    'Monthly rent and lease payments'
FROM (
    SELECT DISTINCT brand_id, outlet_id 
    FROM outlets 
    LIMIT 1
) existing_outlets
WHERE NOT EXISTS (
    SELECT 1 FROM expense_types 
    WHERE brand_id = existing_outlets.brand_id 
    AND outlet_id = existing_outlets.outlet_id
    AND name = 'Rent'
)
LIMIT 1;

INSERT INTO expense_types (brand_id, outlet_id, name, description)
SELECT 
    brand_id, 
    outlet_id, 
    'Supplies',
    'Office supplies, materials, and equipment'
FROM (
    SELECT DISTINCT brand_id, outlet_id 
    FROM outlets 
    LIMIT 1
) existing_outlets
WHERE NOT EXISTS (
    SELECT 1 FROM expense_types 
    WHERE brand_id = existing_outlets.brand_id 
    AND outlet_id = existing_outlets.outlet_id
    AND name = 'Supplies'
)
LIMIT 1;
