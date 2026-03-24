-- Migration: Add missing billing config columns
-- Fixes "column 'tax_rate' does not exist" error

-- Add tax-related columns
ALTER TABLE billing_configs 
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5, 4) DEFAULT 0.05,
ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN DEFAULT false;

-- Add business information columns
ALTER TABLE billing_configs 
ADD COLUMN IF NOT EXISTS header_text TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS business_address TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS business_phone VARCHAR(50) DEFAULT '',
ADD COLUMN IF NOT EXISTS business_email VARCHAR(255) DEFAULT '';

-- Add service charge columns
ALTER TABLE billing_configs 
ADD COLUMN IF NOT EXISTS service_charge_rate DECIMAL(5, 4) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS service_charge_inclusive BOOLEAN DEFAULT false;

-- Add logo column
ALTER TABLE billing_configs 
ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '';

-- Update existing records with default values
UPDATE billing_configs 
SET 
    tax_rate = COALESCE(tax_rate, 0.05),
    tax_inclusive = COALESCE(tax_inclusive, false),
    header_text = COALESCE(header_text, ''),
    business_address = COALESCE(business_address, ''),
    business_phone = COALESCE(business_phone, ''),
    business_email = COALESCE(business_email, ''),
    service_charge_rate = COALESCE(service_charge_rate, 0.00),
    service_charge_inclusive = COALESCE(service_charge_inclusive, false),
    logo_url = COALESCE(logo_url, '')
WHERE tax_rate IS NULL 
   OR tax_inclusive IS NULL 
   OR header_text IS NULL 
   OR business_address IS NULL 
   OR business_phone IS NULL 
   OR business_email IS NULL 
   OR service_charge_rate IS NULL 
   OR service_charge_inclusive IS NULL 
   OR logo_url IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN billing_configs.tax_rate IS 'Tax rate as decimal (0.05 = 5%)';
COMMENT ON COLUMN billing_configs.tax_inclusive IS 'Whether tax is included in prices';
COMMENT ON COLUMN billing_configs.header_text IS 'Header text for receipts';
COMMENT ON COLUMN billing_configs.business_address IS 'Business address for receipts';
COMMENT ON COLUMN billing_configs.business_phone IS 'Business phone for receipts';
COMMENT ON COLUMN billing_configs.business_email IS 'Business email for receipts';
COMMENT ON COLUMN billing_configs.service_charge_rate IS 'Service charge rate as decimal';
COMMENT ON COLUMN billing_configs.service_charge_inclusive IS 'Whether service charge is included in prices';
COMMENT ON COLUMN billing_configs.logo_url IS 'URL of business logo for receipts';
