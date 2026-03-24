-- Add business_name column to outlets table for proper brand identity storage
-- This ensures cafe details are properly saved with the brand information

ALTER TABLE outlets 
ADD COLUMN business_name VARCHAR(255) COMMENT 'Brand/business name from onboarding';

-- Create index for faster lookups
CREATE INDEX idx_outlets_business_name ON outlets(business_name);

-- Update existing outlets to have empty business_name if null
UPDATE outlets SET business_name = '' WHERE business_name IS NULL;
