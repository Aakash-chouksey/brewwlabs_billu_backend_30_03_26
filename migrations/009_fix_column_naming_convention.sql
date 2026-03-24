-- Migration: Fix Column Naming Convention for Tenant Tables
-- Converts snake_case columns to camelCase to match Sequelize models
-- This fixes the "column 'outlet_id' does not exist" error

-- Fix users table
ALTER TABLE users 
    RENAME COLUMN password_hash TO passwordHash,
    RENAME COLUMN primary_outlet_id TO primaryOutletId,
    RENAME COLUMN is_active TO isActive,
    RENAME COLUMN token_version TO tokenVersion,
    RENAME COLUMN assigned_categories TO assignedCategories,
    RENAME COLUMN last_login TO lastLogin;

-- Fix user_outlets table  
ALTER TABLE user_outlets
    RENAME COLUMN user_id TO userId,
    RENAME COLUMN outlet_id TO outletId,
    RENAME COLUMN is_active TO isActive,
    RENAME COLUMN assigned_at TO assignedAt;

-- Fix outlets table
ALTER TABLE outlets
    RENAME COLUMN is_active TO isActive;

-- Fix categories table
-- NOTE: outletId should already exist as camelCase based on error message
-- If it doesn't exist, add it:
-- ALTER TABLE categories ADD COLUMN outletId UUID;

ALTER TABLE categories
    RENAME COLUMN is_enabled TO isEnabled,
    RENAME COLUMN sort_order TO sortOrder;

-- Fix products table
-- NOTE: outletId and categoryId should already exist as camelCase
-- If they don't exist, add them:
-- ALTER TABLE products ADD COLUMN outletId UUID;
-- ALTER TABLE products ADD COLUMN categoryId UUID;

ALTER TABLE products
    RENAME COLUMN is_available TO isAvailable;

-- Fix orders table
-- NOTE: outletId, userId, customerId, tableId should already exist as camelCase
-- If they don't exist, add them:
-- ALTER TABLE orders ADD COLUMN outletId UUID;
-- ALTER TABLE orders ADD COLUMN userId UUID NOT NULL;
-- ALTER TABLE orders ADD COLUMN customerId UUID;
-- ALTER TABLE orders ADD COLUMN tableId UUID;

ALTER TABLE orders
    RENAME COLUMN order_number TO orderNumber,
    RENAME COLUMN customer_id TO customerId,
    RENAME COLUMN user_id TO userId,
    RENAME COLUMN total_amount TO totalAmount,
    RENAME COLUMN payment_method TO paymentMethod,
    RENAME COLUMN payment_status TO paymentStatus,
    RENAME COLUMN table_id TO tableId;

-- Fix inventory table
-- NOTE: outletId and productId should already exist as camelCase
-- If they don't exist, add them:
-- ALTER TABLE inventory ADD COLUMN outletId UUID;
-- ALTER TABLE inventory ADD COLUMN productId UUID NOT NULL;

ALTER TABLE inventory
    RENAME COLUMN min_stock TO minStock,
    RENAME COLUMN max_stock TO maxStock,
    RENAME COLUMN last_updated TO lastUpdated;

-- Update indexes to match new column names
DROP INDEX IF EXISTS users_primary_outlet_id_idx;
CREATE INDEX users_primaryOutletId_idx ON users(primaryOutletId);

DROP INDEX IF EXISTS user_outlets_user_id_idx;
CREATE INDEX user_outlets_userId_idx ON user_outlets(userId);

DROP INDEX IF EXISTS user_outlets_outlet_id_idx;
CREATE INDEX user_outlets_outletId_idx ON user_outlets(outletId);

DROP INDEX IF EXISTS user_outlets_user_id_is_active_idx;
CREATE INDEX user_outlets_userId_isActive_idx ON user_outlets(userId, isActive);

DROP INDEX IF EXISTS user_outlets_user_id_outlet_id_idx;
CREATE INDEX user_outlets_userId_outletId_idx ON user_outlets(userId, outletId);

DROP INDEX IF EXISTS outlets_is_active_idx;
CREATE INDEX outlets_isActive_idx ON outlets(isActive);

DROP INDEX IF EXISTS categories_outlet_id_idx;
CREATE INDEX categories_outletId_idx ON categories(outletId);

DROP INDEX IF EXISTS categories_outlet_id_is_enabled_idx;
CREATE INDEX categories_outletId_isEnabled_idx ON categories(outletId, isEnabled);

DROP INDEX IF EXISTS products_outlet_id_idx;
CREATE INDEX products_outletId_idx ON products(outletId);

DROP INDEX IF EXISTS products_category_id_idx;
CREATE INDEX products_categoryId_idx ON products(categoryId);

DROP INDEX IF EXISTS products_outlet_id_category_id_idx;
CREATE INDEX products_outletId_categoryId_idx ON products(outletId, categoryId);

DROP INDEX IF EXISTS products_outlet_id_is_available_idx;
CREATE INDEX products_outletId_isAvailable_idx ON products(outletId, isAvailable);

DROP INDEX IF EXISTS orders_outlet_id_idx;
CREATE INDEX orders_outletId_idx ON orders(outletId);

DROP INDEX IF EXISTS orders_user_id_idx;
CREATE INDEX orders_userId_idx ON orders(userId);

DROP INDEX IF EXISTS orders_order_number_idx;
CREATE INDEX orders_orderNumber_idx ON orders(orderNumber);

DROP INDEX IF EXISTS inventory_outlet_id_idx;
CREATE INDEX inventory_outletId_idx ON inventory(outletId);

DROP INDEX IF EXISTS inventory_product_id_idx;
CREATE INDEX inventory_productId_idx ON inventory(productId);

DROP INDEX IF EXISTS inventory_outlet_id_product_id_idx;
CREATE INDEX inventory_outletId_productId_idx ON inventory(outletId, productId);

COMMIT;
