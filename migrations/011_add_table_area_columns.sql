-- Migration: Add new columns to tables and areas tables
-- Created: 2026-03-16
-- Purpose: Add missing columns for improved table and area management

-- Add new columns to tables table
ALTER TABLE tables 
ADD COLUMN IF NOT EXISTS table_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS shape VARCHAR(20) DEFAULT 'square' CHECK (shape IN ('square', 'round', 'rectangular')),
ADD COLUMN IF NOT EXISTS current_occupancy INTEGER DEFAULT 0;

-- Add new columns to table_areas table  
ALTER TABLE table_areas
ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS layout VARCHAR(20) DEFAULT 'square' CHECK (layout IN ('square', 'rectangular', 'circular', 'linear')),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive'));

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tables_table_no ON tables(table_no);
CREATE INDEX IF NOT EXISTS idx_tables_shape ON tables(shape);
CREATE INDEX IF NOT EXISTS idx_table_areas_layout ON table_areas(layout);
CREATE INDEX IF NOT EXISTS idx_table_areas_status ON table_areas(status);

-- Update existing records with default values if needed
UPDATE tables SET shape = 'square' WHERE shape IS NULL;
UPDATE tables SET current_occupancy = 0 WHERE current_occupancy IS NULL;
UPDATE table_areas SET capacity = 20 WHERE capacity IS NULL;
UPDATE table_areas SET layout = 'square' WHERE layout IS NULL;
UPDATE table_areas SET status = 'active' WHERE status IS NULL;
