# Database Architecture Refactor - Migration Plan

## Overview
This migration plan refactors the multi-tenant POS platform database architecture to support:
- Franchise hierarchy
- Proper control plane separation
- Outlet-scoped menus
- Efficient user-outlet mapping
- Strict tenant isolation

## Migration Files

### 002_fix_brand_hierarchy.sql
**Purpose**: Rename businesses → brands and implement franchise hierarchy
**Changes**:
- Adds `type` ENUM (SOLO, MASTER_FRANCHISE, FRANCHISE, SUB_FRANCHISE)
- Adds `parent_brand_id` self-referencing foreign key
- Safely migrates data from `businesses` to `brands` table
- Updates foreign key references in `tenant_connections` and `subscriptions`

**Safety**: Creates backup of original `businesses` table as `businesses_backup_20240305`

### 003_fix_tenant_product_category_scope.sql
**Purpose**: Add outletId to categories and products for outlet-specific menus
**Changes**:
- Adds `outletId` UUID column to `categories` and `products` tables
- Creates indexes for efficient outlet-scoped queries
- Backfills existing data with first outlet of each business
- Adds foreign key constraints

**Impact**: Enables different menus/pricing per outlet within the same business

### 004_fix_user_outlet_mapping.sql
**Purpose**: Convert JSONB outletIds to proper relational user_outlets mapping table
**Changes**:
- Adds `primary_outlet_id` to users table
- Creates `user_outlets` mapping table with proper relationships
- Migrates data from JSONB `outletIds` to relational structure
- Creates `user_outlet_details` view for easier querying

**Benefits**: 
- Fast joins instead of JSONB operations
- Scalable permissions
- Audit trail for outlet assignments

### 005_remove_plans_from_tenant_databases.sql
**Purpose**: Remove plans table from tenant databases (should only exist in control plane)
**Changes**:
- Safely backs up existing plans data
- Drops plans table from tenant databases
- Updates subscriptions to use plan_name reference
- Removes foreign key constraints

**Impact**: Centralizes plan management in control plane

## Execution Order

1. **Control Plane Migrations First**:
   ```bash
   # Run on control plane database
   psql -d control_plane_db -f migrations/002_fix_brand_hierarchy.sql
   ```

2. **Tenant Database Migrations** (run on each tenant database):
   ```bash
   # Run on each tenant database
   psql -d tenant_db_1 -f migrations/003_fix_tenant_product_category_scope.sql
   psql -d tenant_db_1 -f migrations/004_fix_user_outlet_mapping.sql
   psql -d tenant_db_1 -f migrations/005_remove_plans_from_tenant_databases.sql
   ```

## Verification Queries

### Control Plane Verification
```sql
-- Verify brands table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'brands' 
ORDER BY ordinal_position;

-- Verify franchise hierarchy
SELECT COUNT(*) as total_brands,
       COUNT(CASE WHEN parent_brand_id IS NOT NULL THEN 1 END) as child_brands,
       COUNT(CASE WHEN parent_brand_id IS NULL THEN 1 END) as root_brands
FROM brands;

-- Verify plans table exists in control plane
SELECT COUNT(*) FROM plans;
```

### Tenant Database Verification
```sql
-- Verify outletId columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('categories', 'products') 
AND column_name = 'outletId';

-- Verify user_outlets mapping
SELECT COUNT(*) as total_mappings,
       COUNT(DISTINCT user_id) as unique_users,
       COUNT(DISTINCT outlet_id) as unique_outlets
FROM user_outlets;

-- Verify plans table is removed
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'plans'
) as plans_exists;
```

## Rollback Plan

Each migration includes safety measures:
- Original tables backed up with timestamps
- Data validation before destructive operations
- Comments for audit trail

To rollback:
1. Restore from backup tables
2. Reverse foreign key changes
3. Verify data integrity

## Post-Migration Tasks

1. **Update Application Code**:
   - Use new Brand model with hierarchy support
   - Update user-outlet permission checks
   - Use outlet-scoped product/category queries

2. **Performance Optimization**:
   - Analyze query performance with new indexes
   - Monitor connection pool efficiency
   - Validate 10k concurrent user capacity

3. **Security Validation**:
   - Test tenant isolation enforcement
   - Verify control plane/tenant separation
   - Audit franchise hierarchy permissions

## Configuration Updates

Update environment variables if needed:
```bash
# Connection pooling (already configured)
MAX_ACTIVE_TENANTS=100
TENANT_POOL_MAX=2

# Franchise hierarchy support
FRANCHISE_HIERARCHY_ENABLED=true
```

## Monitoring

After migration, monitor:
- Database performance metrics
- Connection pool usage
- Tenant isolation violations
- Franchise hierarchy query performance
