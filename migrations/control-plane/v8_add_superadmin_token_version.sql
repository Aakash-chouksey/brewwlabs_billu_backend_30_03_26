-- Migration: Add token_version to super_admin_users
-- Created: 2026-03-27
-- Purpose: Fix missing column for auth token invalidation

-- Add token_version column to super_admin_users table
ALTER TABLE public.super_admin_users 
ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0;

-- Add comment explaining the column
COMMENT ON COLUMN public.super_admin_users.token_version IS 'Token version for invalidating all user sessions';
