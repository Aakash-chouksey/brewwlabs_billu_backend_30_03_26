-- Multi-Tenant Security Migration Script
-- This script adds constraints and indexes to enforce strict tenant isolation

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add businessId constraints to ensure NOT NULL for non-SuperAdmin users
-- Note: We'll keep allowNull: true in models but enforce at application level
-- because SuperAdmin users may not have businessId

-- Create composite indexes for tenant isolation
-- These indexes ensure efficient queries and prevent cross-tenant data access

-- Users table indexes
CREATE INDEX IF NOT EXISTS "users_business_id_idx" ON "Users" ("businessId") WHERE "businessId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "users_business_role_idx" ON "Users" ("businessId", "role") WHERE "businessId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "users_business_created_idx" ON "Users" ("businessId", "createdAt") WHERE "businessId" IS NOT NULL;

-- Business table indexes (for SuperAdmin operations)
CREATE INDEX IF NOT EXISTS "businesses_status_idx" ON "Businesses" ("status");
CREATE INDEX IF NOT EXISTS "businesses_created_idx" ON "Businesses" ("createdAt");

-- Outlets table indexes
CREATE INDEX IF NOT EXISTS "outlets_business_idx" ON "Outlets" ("businessId");
CREATE INDEX IF NOT EXISTS "outlets_business_active_idx" ON "Outlets" ("businessId", "isActive");
CREATE INDEX IF NOT EXISTS "outlets_business_created_idx" ON "Outlets" ("businessId", "createdAt");

-- Categories table indexes
CREATE INDEX IF NOT EXISTS "categories_business_idx" ON "Categories" ("businessId");
CREATE UNIQUE INDEX IF NOT EXISTS "categories_business_name_unique_idx" ON "Categories" ("businessId", "name");
CREATE INDEX IF NOT EXISTS "categories_business_created_idx" ON "Categories" ("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "categories_business_enabled_idx" ON "Categories" ("businessId", "isEnabled");

-- Products table indexes
CREATE INDEX IF NOT EXISTS "products_business_idx" ON "Products" ("businessId");
CREATE UNIQUE INDEX IF NOT EXISTS "products_business_name_unique_idx" ON "Products" ("businessId", "name");
CREATE INDEX IF NOT EXISTS "products_business_created_idx" ON "Products" ("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "products_business_category_idx" ON "Products" ("businessId", "categoryId");
CREATE INDEX IF NOT EXISTS "products_business_available_idx" ON "Products" ("businessId", "isAvailable");

-- Tables table indexes
CREATE INDEX IF NOT EXISTS "tables_business_idx" ON "Tables" ("businessId");
CREATE INDEX IF NOT EXISTS "tables_business_outlet_idx" ON "Tables" ("businessId", "outletId");
CREATE INDEX IF NOT EXISTS "tables_business_created_idx" ON "Tables" ("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "tables_business_outlet_status_idx" ON "Tables" ("businessId", "outletId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "tables_business_outlet_name_unique_idx" ON "Tables" ("businessId", "outletId", "name");

-- Orders table indexes
CREATE INDEX IF NOT EXISTS "orders_business_idx" ON "Orders" ("businessId");
CREATE INDEX IF NOT EXISTS "orders_business_outlet_idx" ON "Orders" ("businessId", "outletId");
CREATE INDEX IF NOT EXISTS "orders_business_created_idx" ON "Orders" ("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "orders_business_status_idx" ON "Orders" ("businessId", "orderStatus");
CREATE UNIQUE INDEX IF NOT EXISTS "orders_idempotency_key_unique_idx" ON "Orders" ("idempotencyKey");

-- Areas table indexes
CREATE INDEX IF NOT EXISTS "areas_business_idx" ON "Areas" ("businessId");
CREATE INDEX IF NOT EXISTS "areas_business_outlet_idx" ON "Areas" ("businessId", "outletId");
CREATE INDEX IF NOT EXISTS "areas_business_created_idx" ON "Areas" ("businessId", "createdAt");

-- Inventory table indexes
CREATE INDEX IF NOT EXISTS "inventories_business_idx" ON "Inventories" ("businessId");
CREATE INDEX IF NOT EXISTS "inventories_business_outlet_idx" ON "Inventories" ("businessId", "outletId");
CREATE INDEX IF NOT EXISTS "inventories_business_created_idx" ON "Inventories" ("businessId", "createdAt");

-- Payments table indexes
CREATE INDEX IF NOT EXISTS "payments_business_idx" ON "Payments" ("businessId");
CREATE INDEX IF NOT EXISTS "payments_business_outlet_idx" ON "Payments" ("businessId", "outletId");
CREATE INDEX IF NOT EXISTS "payments_business_created_idx" ON "Payments" ("businessId", "createdAt");

-- Transactions table indexes
CREATE INDEX IF NOT EXISTS "transactions_business_idx" ON "Transactions" ("businessId");
CREATE INDEX IF NOT EXISTS "transactions_business_created_idx" ON "Transactions" ("businessId", "createdAt");

-- Accounts table indexes
CREATE INDEX IF NOT EXISTS "accounts_business_idx" ON "Accounts" ("businessId");
CREATE INDEX IF NOT EXISTS "accounts_business_outlet_idx" ON "Accounts" ("businessId", "outletId");
CREATE INDEX IF NOT EXISTS "accounts_business_created_idx" ON "Accounts" ("businessId", "createdAt");

-- Expenses table indexes
CREATE INDEX IF NOT EXISTS "expenses_business_idx" ON "Expenses" ("businessId");
CREATE INDEX IF NOT EXISTS "expenses_business_outlet_idx" ON "Expenses" ("businessId", "outletId");
CREATE INDEX IF NOT EXISTS "expenses_business_created_idx" ON "Expenses" ("businessId", "createdAt");

-- Income table indexes
CREATE INDEX IF NOT EXISTS "incomes_business_idx" ON "Incomes" ("businessId");
CREATE INDEX IF NOT EXISTS "incomes_business_outlet_idx" ON "Incomes" ("businessId", "outletId");
CREATE INDEX IF NOT EXISTS "incomes_business_created_idx" ON "Incomes" ("businessId", "createdAt");

-- Purchases table indexes
CREATE INDEX IF NOT EXISTS "purchases_business_idx" ON "Purchases" ("businessId");
CREATE INDEX IF NOT EXISTS "purchases_business_outlet_idx" ON "Purchases" ("businessId", "outletId");
CREATE INDEX IF NOT EXISTS "purchases_business_created_idx" ON "Purchases" ("businessId", "createdAt");

-- ExpenseTypes table indexes
CREATE INDEX IF NOT EXISTS "expense_types_business_idx" ON "ExpenseTypes" ("businessId");
CREATE INDEX IF NOT EXISTS "expense_types_business_created_idx" ON "ExpenseTypes" ("businessId", "createdAt");

-- Timing table indexes
CREATE INDEX IF NOT EXISTS "timings_outlet_idx" ON "Timings" ("outletId");

-- Add foreign key constraints for tenant relationships
-- These constraints ensure referential integrity across tenant boundaries

-- Ensure outlets belong to their business
ALTER TABLE "Outlets" 
ADD CONSTRAINT "outlets_business_fkey" 
FOREIGN KEY ("businessId") REFERENCES "Businesses" ("id") ON DELETE CASCADE;

-- Ensure users belong to their business (when businessId is not null)
ALTER TABLE "Users" 
ADD CONSTRAINT "users_business_fkey" 
FOREIGN KEY ("businessId") REFERENCES "Businesses" ("id") ON DELETE SET NULL;

-- Ensure categories belong to their business
ALTER TABLE "Categories" 
ADD CONSTRAINT "categories_business_fkey" 
FOREIGN KEY ("businessId") REFERENCES "Businesses" ("id") ON DELETE CASCADE;

-- Ensure products belong to their business
ALTER TABLE "Products" 
ADD CONSTRAINT "products_business_fkey" 
FOREIGN KEY ("businessId") REFERENCES "Businesses" ("id") ON DELETE CASCADE;

-- Ensure tables belong to their business and outlet
ALTER TABLE "Tables" 
ADD CONSTRAINT "tables_business_fkey" 
FOREIGN KEY ("businessId") REFERENCES "Businesses" ("id") ON DELETE CASCADE,
ADD CONSTRAINT "tables_outlet_fkey" 
FOREIGN KEY ("outletId") REFERENCES "Outlets" ("id") ON DELETE CASCADE;

-- Ensure orders belong to their business and outlet
ALTER TABLE "Orders" 
ADD CONSTRAINT "orders_business_fkey" 
FOREIGN KEY ("businessId") REFERENCES "Businesses" ("id") ON DELETE CASCADE,
ADD CONSTRAINT "orders_outlet_fkey" 
FOREIGN KEY ("outletId") REFERENCES "Outlets" ("id") ON DELETE CASCADE;

-- Ensure areas belong to their business and outlet
ALTER TABLE "Areas" 
ADD CONSTRAINT "areas_business_fkey" 
FOREIGN KEY ("businessId") REFERENCES "Businesses" ("id") ON DELETE CASCADE,
ADD CONSTRAINT "areas_outlet_fkey" 
FOREIGN KEY ("outletId") REFERENCES "Outlets" ("id") ON DELETE CASCADE;

-- Ensure inventory belongs to their business and outlet
ALTER TABLE "Inventories" 
ADD CONSTRAINT "inventories_business_fkey" 
FOREIGN KEY ("businessId") REFERENCES "Businesses" ("id") ON DELETE CASCADE,
ADD CONSTRAINT "inventories_outlet_fkey" 
FOREIGN KEY ("outletId") REFERENCES "Outlets" ("id") ON DELETE CASCADE;

-- Ensure payments belong to their business and outlet
ALTER TABLE "Payments" 
ADD CONSTRAINT "payments_business_fkey" 
FOREIGN KEY ("businessId") REFERENCES "Businesses" ("id") ON DELETE CASCADE,
ADD CONSTRAINT "payments_outlet_fkey" 
FOREIGN KEY ("outletId") REFERENCES "Outlets" ("id") ON DELETE CASCADE;

-- Ensure transactions belong to their business
ALTER TABLE "Transactions" 
ADD CONSTRAINT "transactions_business_fkey" 
FOREIGN KEY ("businessId") REFERENCES "Businesses" ("id") ON DELETE CASCADE;

-- Ensure accounts belong to their business and outlet
ALTER TABLE "Accounts" 
ADD CONSTRAINT "accounts_business_fkey" 
FOREIGN KEY ("businessId") REFERENCES "Businesses" ("id") ON DELETE CASCADE,
ADD CONSTRAINT "accounts_outlet_fkey" 
FOREIGN KEY ("outletId") REFERENCES "Outlets" ("id") ON DELETE CASCADE;

-- Ensure expenses belong to their business and outlet
ALTER TABLE "Expenses" 
ADD CONSTRAINT "expenses_business_fkey" 
FOREIGN KEY ("businessId") REFERENCES "Businesses" ("id") ON DELETE CASCADE,
ADD CONSTRAINT "expenses_outlet_fkey" 
FOREIGN KEY ("outletId") REFERENCES "Outlets" ("id") ON DELETE CASCADE;

-- Ensure income belongs to their business and outlet
ALTER TABLE "Incomes" 
ADD CONSTRAINT "incomes_business_fkey" 
FOREIGN KEY ("businessId") REFERENCES "Businesses" ("id") ON DELETE CASCADE,
ADD CONSTRAINT "incomes_outlet_fkey" 
FOREIGN KEY ("outletId") REFERENCES "Outlets" ("id") ON DELETE CASCADE;

-- Ensure purchases belong to their business and outlet
ALTER TABLE "Purchases" 
ADD CONSTRAINT "purchases_business_fkey" 
FOREIGN KEY ("businessId") REFERENCES "Businesses" ("id") ON DELETE CASCADE,
ADD CONSTRAINT "purchases_outlet_fkey" 
FOREIGN KEY ("outletId") REFERENCES "Outlets" ("id") ON DELETE CASCADE;

-- Ensure expense types belong to their business
ALTER TABLE "ExpenseTypes" 
ADD CONSTRAINT "expense_types_business_fkey" 
FOREIGN KEY ("businessId") REFERENCES "Businesses" ("id") ON DELETE CASCADE;

-- Ensure timings belong to their outlet
ALTER TABLE "Timings" 
ADD CONSTRAINT "timings_outlet_fkey" 
FOREIGN KEY ("outletId") REFERENCES "Outlets" ("id") ON DELETE CASCADE;

-- Create audit table for security events
CREATE TABLE IF NOT EXISTS "SecurityAuditLogs" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "businessId" UUID,
    "userId" UUID,
    "eventType" VARCHAR(100) NOT NULL,
    "eventDescription" TEXT,
    "ipAddress" INET,
    "userAgent" TEXT,
    "requestPath" VARCHAR(500),
    "httpMethod" VARCHAR(10),
    "statusCode" INTEGER,
    "tenantId" UUID, -- For future multi-tenant architecture
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Security audit log indexes
CREATE INDEX IF NOT EXISTS "security_audit_business_idx" ON "SecurityAuditLogs" ("businessId") WHERE "businessId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "security_audit_user_idx" ON "SecurityAuditLogs" ("userId") WHERE "userId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "security_audit_event_idx" ON "SecurityAuditLogs" ("eventType");
CREATE INDEX IF NOT EXISTS "security_audit_created_idx" ON "SecurityAuditLogs" ("createdAt");

-- Add RLS (Row Level Security) for additional tenant isolation (PostgreSQL specific)
-- This provides database-level enforcement of tenant isolation

-- Enable RLS on tenant-owned tables
ALTER TABLE "Outlets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Areas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Inventories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Incomes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Purchases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpenseTypes" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (These would need to be customized based on your authentication setup)
-- Example policy for Outlets table
CREATE POLICY "tenant_isolation_outlets" ON "Outlets"
    FOR ALL
    TO authenticated_role -- Replace with your actual database role
    USING (businessId = current_setting('app.current_business_id')::UUID);

-- Note: RLS policies would need to be set for each table and customized
-- based on your database authentication setup. This is a template that would
-- need to be adapted to your specific authentication context.

COMMIT;
