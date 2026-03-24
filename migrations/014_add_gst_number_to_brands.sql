-- Add GST number column to brands table
ALTER TABLE brands ADD COLUMN IF NOT EXISTS gst_number VARCHAR(20);

-- Add index for GST number if needed
CREATE INDEX IF NOT EXISTS idx_brands_gst_number ON brands(gst_number);

-- Add comment for documentation
COMMENT ON COLUMN brands.gst_number IS 'GST registration number for the business (15 alphanumeric characters)';
