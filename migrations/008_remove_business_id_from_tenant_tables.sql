-- Migration: Remove business_id columns from tenant tables
-- Database-per-tenant architecture means business_id filtering is unnecessary

-- Remove business_id column from users table
ALTER TABLE users DROP COLUMN IF EXISTS business_id;

-- Remove business_id column from outlets table
ALTER TABLE outlets DROP COLUMN IF EXISTS business_id;

-- Remove business_id column from categories table
ALTER TABLE categories DROP COLUMN IF EXISTS business_id;

-- Remove business_id column from products table
ALTER TABLE products DROP COLUMN IF EXISTS business_id;

-- Remove business_id column from orders table
ALTER TABLE orders DROP COLUMN IF EXISTS business_id;

-- Remove business_id column from inventory table
ALTER TABLE inventory DROP COLUMN IF EXISTS business_id;

-- Drop indexes that include business_id (they will be automatically recreated if needed)
DROP INDEX IF EXISTS users_businessId_idx;
DROP INDEX IF EXISTS users_businessId_primary_outlet_id_idx;
DROP INDEX IF EXISTS users_businessId_role_idx;
DROP INDEX IF EXISTS outlets_businessId_idx;
DROP INDEX IF EXISTS outlets_businessId_isActive_idx;
DROP INDEX IF EXISTS categories_businessId_idx;
DROP INDEX IF EXISTS categories_businessId_outletId_idx;
DROP INDEX IF EXISTS categories_businessId_outletId_isEnabled_idx;
DROP INDEX IF EXISTS products_businessId_idx;
DROP INDEX IF EXISTS products_businessId_outletId_idx;
DROP INDEX IF EXISTS products_businessId_categoryId_idx;
DROP INDEX IF EXISTS products_businessId_outletId_categoryId_idx;
DROP INDEX IF EXISTS products_businessId_outletId_isAvailable_idx;
DROP INDEX IF EXISTS orders_businessId_idx;
DROP INDEX IF EXISTS orders_businessId_outletId_idx;
DROP INDEX IF EXISTS orders_businessId_status_idx;
DROP INDEX IF EXISTS orders_businessId_createdAt_idx;
DROP INDEX IF EXISTS inventory_businessId_idx;
DROP INDEX IF EXISTS inventory_businessId_outletId_idx;
DROP INDEX IF EXISTS inventory_businessId_productId_idx;

-- Add comments explaining database-per-tenant architecture
COMMENT ON TABLE users IS 'User table - database-per-tenant architecture, no business_id needed';
COMMENT ON TABLE outlets IS 'Outlet table - database-per-tenant architecture, no business_id needed';
COMMENT ON TABLE categories IS 'Category table - database-per-tenant architecture, no business_id needed';
COMMENT ON TABLE products IS 'Product table - database-per-tenant architecture, no business_id needed';
COMMENT ON TABLE orders IS 'Order table - database-per-tenant architecture, no business_id needed';
COMMENT ON TABLE inventory IS 'Inventory table - database-per-tenant architecture, no business_id needed';

COMMIT;
