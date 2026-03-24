-- Migration: Add new columns to product_types table
-- Created: 2026-03-16
-- Purpose: Add description, icon, and color fields for enhanced product type management

-- Add new columns to product_types table
ALTER TABLE product_types 
ADD COLUMN IF NOT EXISTS description VARCHAR(255),
ADD COLUMN IF NOT EXISTS icon VARCHAR(10) DEFAULT '🥬',
ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#10B981';

-- Update existing records with default values if needed
UPDATE product_types SET icon = '🥬' WHERE icon IS NULL;
UPDATE product_types SET color = '#10B981' WHERE color IS NULL;
