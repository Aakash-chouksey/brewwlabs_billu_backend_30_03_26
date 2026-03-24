-- Migration: Fix column naming convention for camelCase to snake_case mapping
-- This ensures Sequelize underscored: true works correctly
-- Date: 2025-01-05

-- Fix users table
DO $$
BEGIN
    -- Check if column exists and rename if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'passwordHash') THEN
        ALTER TABLE users RENAME COLUMN "passwordHash" TO password_hash;
        RAISE NOTICE 'Renamed users.passwordHash to password_hash';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'primaryOutletId') THEN
        ALTER TABLE users RENAME COLUMN "primaryOutletId" TO primary_outlet_id;
        RAISE NOTICE 'Renamed users.primaryOutletId to primary_outlet_id';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'isActive') THEN
        ALTER TABLE users RENAME COLUMN "isActive" TO is_active;
        RAISE NOTICE 'Renamed users.isActive to is_active';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'tokenVersion') THEN
        ALTER TABLE users RENAME COLUMN "tokenVersion" TO token_version;
        RAISE NOTICE 'Renamed users.tokenVersion to token_version';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'assignedCategories') THEN
        ALTER TABLE users RENAME COLUMN "assignedCategories" TO assigned_categories;
        RAISE NOTICE 'Renamed users.assignedCategories to assigned_categories';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'lastLogin') THEN
        ALTER TABLE users RENAME COLUMN "lastLogin" TO last_login;
        RAISE NOTICE 'Renamed users.lastLogin to last_login';
    END IF;
END $$;

-- Fix user_outlets table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_outlets' AND column_name = 'userId') THEN
        ALTER TABLE user_outlets RENAME COLUMN "userId" TO user_id;
        RAISE NOTICE 'Renamed user_outlets.userId to user_id';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_outlets' AND column_name = 'outletId') THEN
        ALTER TABLE user_outlets RENAME COLUMN "outletId" TO outlet_id;
        RAISE NOTICE 'Renamed user_outlets.outletId to outlet_id';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_outlets' AND column_name = 'isActive') THEN
        ALTER TABLE user_outlets RENAME COLUMN "isActive" TO is_active;
        RAISE NOTICE 'Renamed user_outlets.isActive to is_active';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_outlets' AND column_name = 'assignedAt') THEN
        ALTER TABLE user_outlets RENAME COLUMN "assignedAt" TO assigned_at;
        RAISE NOTICE 'Renamed user_outlets.assignedAt to assigned_at';
    END IF;
END $$;

-- Fix outlets table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outlets' AND column_name = 'isActive') THEN
        ALTER TABLE outlets RENAME COLUMN "isActive" TO is_active;
        RAISE NOTICE 'Renamed outlets.isActive to is_active';
    END IF;
END $$;

-- Fix categories table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'outletId') THEN
        ALTER TABLE categories RENAME COLUMN "outletId" TO outlet_id;
        RAISE NOTICE 'Renamed categories.outletId to outlet_id';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'isEnabled') THEN
        ALTER TABLE categories RENAME COLUMN "isEnabled" TO is_enabled;
        RAISE NOTICE 'Renamed categories.isEnabled to is_enabled';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'sortOrder') THEN
        ALTER TABLE categories RENAME COLUMN "sortOrder" TO sort_order;
        RAISE NOTICE 'Renamed categories.sortOrder to sort_order';
    END IF;
END $$;

-- Fix products table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'outletId') THEN
        ALTER TABLE products RENAME COLUMN "outletId" TO outlet_id;
        RAISE NOTICE 'Renamed products.outletId to outlet_id';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'categoryId') THEN
        ALTER TABLE products RENAME COLUMN "categoryId" TO category_id;
        RAISE NOTICE 'Renamed products.categoryId to category_id';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'isAvailable') THEN
        ALTER TABLE products RENAME COLUMN "isAvailable" TO is_available;
        RAISE NOTICE 'Renamed products.isAvailable to is_available';
    END IF;
END $$;

-- Fix orders table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'outletId') THEN
        ALTER TABLE orders RENAME COLUMN "outletId" TO outlet_id;
        RAISE NOTICE 'Renamed orders.outletId to outlet_id';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'orderNumber') THEN
        ALTER TABLE orders RENAME COLUMN "orderNumber" TO order_number;
        RAISE NOTICE 'Renamed orders.orderNumber to order_number';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customerId') THEN
        ALTER TABLE orders RENAME COLUMN "customerId" TO customer_id;
        RAISE NOTICE 'Renamed orders.customerId to customer_id';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'userId') THEN
        ALTER TABLE orders RENAME COLUMN "userId" TO user_id;
        RAISE NOTICE 'Renamed orders.userId to user_id';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'totalAmount') THEN
        ALTER TABLE orders RENAME COLUMN "totalAmount" TO total_amount;
        RAISE NOTICE 'Renamed orders.totalAmount to total_amount';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'paymentMethod') THEN
        ALTER TABLE orders RENAME COLUMN "paymentMethod" TO payment_method;
        RAISE NOTICE 'Renamed orders.paymentMethod to payment_method';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'paymentStatus') THEN
        ALTER TABLE orders RENAME COLUMN "paymentStatus" TO payment_status;
        RAISE NOTICE 'Renamed orders.paymentStatus to payment_status';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'tableId') THEN
        ALTER TABLE orders RENAME COLUMN "tableId" TO table_id;
        RAISE NOTICE 'Renamed orders.tableId to table_id';
    END IF;
END $$;

-- Fix inventory table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'outletId') THEN
        ALTER TABLE inventory RENAME COLUMN "outletId" TO outlet_id;
        RAISE NOTICE 'Renamed inventory.outletId to outlet_id';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'productId') THEN
        ALTER TABLE inventory RENAME COLUMN "productId" TO product_id;
        RAISE NOTICE 'Renamed inventory.productId to product_id';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'minStock') THEN
        ALTER TABLE inventory RENAME COLUMN "minStock" TO min_stock;
        RAISE NOTICE 'Renamed inventory.minStock to min_stock';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'maxStock') THEN
        ALTER TABLE inventory RENAME COLUMN "maxStock" TO max_stock;
        RAISE NOTICE 'Renamed inventory.maxStock to max_stock';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'lastUpdated') THEN
        ALTER TABLE inventory RENAME COLUMN "lastUpdated" TO last_updated;
        RAISE NOTICE 'Renamed inventory.lastUpdated to last_updated';
    END IF;
END $$;

-- Update indexes to use snake_case column names where needed
DO $$
BEGIN
    -- Drop and recreate indexes with correct column names
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'users' AND indexname = 'users_primary_outlet_id_idx') THEN
        DROP INDEX IF EXISTS users_primary_outlet_id_idx;
        CREATE INDEX users_primary_outlet_id_idx ON users(primary_outlet_id);
        RAISE NOTICE 'Recreated users_primary_outlet_id_idx';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'user_outlets' AND indexname = 'user_outlets_user_id_idx') THEN
        DROP INDEX IF EXISTS user_outlets_user_id_idx;
        CREATE INDEX user_outlets_user_id_idx ON user_outlets(user_id);
        RAISE NOTICE 'Recreated user_outlets_user_id_idx';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'user_outlets' AND indexname = 'user_outlets_outlet_id_idx') THEN
        DROP INDEX IF EXISTS user_outlets_outlet_id_idx;
        CREATE INDEX user_outlets_outlet_id_idx ON user_outlets(outlet_id);
        RAISE NOTICE 'Recreated user_outlets_outlet_id_idx';
    END IF;
END $$;

RAISE NOTICE '✅ Column naming convention migration completed successfully';
RAISE NOTICE 'All camelCase columns have been renamed to snake_case for Sequelize compatibility';
