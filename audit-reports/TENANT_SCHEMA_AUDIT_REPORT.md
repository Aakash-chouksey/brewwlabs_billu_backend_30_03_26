# COMPREHENSIVE TENANT ONBOARDING & SCHEMA AUDIT REPORT

**Generated:** March 29, 2026  
**Auditor:** Cascade AI  
**Scope:** Full tenant lifecycle from onboarding to production

---

## EXECUTIVE SUMMARY

### 🔴 Critical Issues Found
1. **Missing `productType.status` column** - Causes API crashes in tenant schemas
2. **Migration baseline v1 missing status column** - Migration v12 exists but may not run on all schemas
3. **Schema validation gaps** - Schema validator doesn't check all required columns
4. **No automatic migration enforcement** - Tenant activation doesn't guarantee all migrations applied

### 🟡 Warnings
1. Settings table not seeded during onboarding (category, outlet, area are seeded)
2. No verification that schema_versions table exists before running migrations
3. Migration runner may fail silently on missing tables

---

## 1. ONBOARDING FLOW ANALYSIS

### Current Flow (Verified from onboardingService.js)

```
1. PRE-VALIDATION
   └─ Check business/admin email uniqueness
   
2. CONTROL PLANE SETUP (Transactional)
   ├─ Create Business (public schema)
   ├─ Create Admin User (public schema)
   └─ Create Tenant Registry with status 'CREATING'
   
3. TENANT SCHEMA INITIALIZATION
   ├─ Create schema: tenant_{businessId}
   ├─ Run tenantModelLoader.initializeTenantSchema()
   │   ├─ Sync all models sequentially (MODEL_LOAD_ORDER)
   │   ├─ Seed schema_versions table with version 12
   │   └─ Run tenantMigrationService.runPendingMigrations()
   └─ Get list of created tables
   
4. DEFAULT DATA SEEDING
   ├─ Create Outlet (REQUIRED - 'Main Outlet')
   ├─ Create Category (REQUIRED - 'Default Category')
   ├─ Create Area (optional - 'Main Area')
   └─ Create InventoryCategory (optional)
   
5. SCHEMA VALIDATION
   └─ validateTenantSchemaComplete()
      ├─ Check all TENANT_MODELS have corresponding tables
      ├─ Check system columns (id, business_id, created_at, updated_at)
      ├─ Check outlet_id for scoped tables
      └─ Check sku for product tables
      
6. TENANT ACTIVATION
   └─ Update tenant_registry status to 'ACTIVE'
```

### ✅ Onboarding Guarantees (Verified)

| Guarantee | Status | Evidence |
|-----------|--------|----------|
| Schema created | ✅ PASS | `CREATE SCHEMA IF NOT EXISTS` in tenantModelLoader.js:146 |
| All tables created | ✅ PASS | Sequential model sync in MODEL_LOAD_ORDER |
| At least 1 outlet | ✅ PASS | `outlet = await models.Outlet.schema(schemaName).create()` in onboardingService.js:245 |
| Tenant status = ACTIVE after setup | ✅ PASS | `UPDATE tenant_registry SET status = 'ACTIVE'` in onboardingService.js:160 |
| Schema validation runs | ✅ PASS | `validateTenantSchemaComplete()` called before activation |

---

## 2. SCHEMA MISMATCH ANALYSIS

### Critical Finding: product_types Table

**Sequelize Model (productTypeModel.js:49-54)**
```javascript
status: {
    field: 'status',
    type: DataTypes.STRING,
    defaultValue: 'active',
    allowNull: false
}
```

**Migration v1 Baseline (v1_init.js:49-60)**
```sql
CREATE TABLE IF NOT EXISTS "${s}"."product_types" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "outlet_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(255),
    "icon" VARCHAR(255) DEFAULT '🥬',
    "color" VARCHAR(255) DEFAULT '#10B981',
    "category_id" UUID,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
-- MISSING: "status" column!
```

**Migration v12 Fix (v12_add_product_type_status.js)**
```javascript
// This migration SHOULD add the status column
await sequelize.query(`
    ALTER TABLE "${schemaName}"."product_types" 
    ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT 'active'
`, options);
```

### Problem Analysis

1. **v1_init.js creates table WITHOUT status column**
2. **v12 migration ADDS status column**
3. **BUT:** If migration v12 fails or doesn't run, table remains broken
4. **Result:** Any query selecting `status` column crashes

### Other Missing Columns Detected

| Table | Missing Column | Impact | Severity |
|-------|---------------|--------|----------|
| product_types | status | API crash when filtering by status | 🔴 CRITICAL |
| products | is_active, tax_rate, sku | Product management incomplete | 🟡 HIGH |
| categories | is_enabled | Category filtering issues | 🟡 HIGH |
| tables | status | Table management issues | 🟡 HIGH |

---

## 3. MIGRATION SYSTEM ANALYSIS

### How Migrations Work

1. **Migration Files Location:** `migrations/tenant/*.js`
2. **Migration Tracking:** `schema_versions` table per tenant
3. **Runner:** `tenantMigrationService.runPendingMigrations()`

### Migration Flow

```
1. Get current version from schema_versions table
2. Find all migrations with version > current
3. For each pending migration:
   ├─ Run migration.up(sequelize, schemaName, models, transaction)
   ├─ Insert record into schema_versions
   └─ Commit transaction
```

### Migration Issues Found

1. **No pre-check for schema_versions table existence**
   - If table doesn't exist, migration fails silently
   
2. **Baseline version inconsistency**
   - v1_init.js creates tables
   - But doesn't insert schema_versions records
   - tenantModelLoader seeds versions 0 and 12
   
3. **No rollback mechanism**
   - Failed migrations don't auto-recover

---

## 4. FRONTEND API COMPATIBILITY

### Safe Data Access Patterns (Verified)

✅ **Good: Safe extraction with fallbacks**
```javascript
// apiDataMappers.js pattern
const mapProductType = (apiType) => {
    if (!apiType) return null;
    const type = keysToCamelCase(apiType);
    return {
        id: getSafeString(type.id),
        name: getSafeString(type.name, 'Unnamed Type'),
        status: getSafeString(type.status, 'active'), // <-- Fallback!
        // ...
    };
};
```

❌ **Bad: Direct property access without fallback**
```javascript
// This would crash if status is null
const status = productType.status; // undefined
const upperStatus = status.toUpperCase(); // CRASH!
```

### Current Frontend Status

| Component | Pattern | Status |
|-----------|---------|--------|
| apiDataMappers.js | Safe mapping with fallbacks | ✅ Safe |
| OrderCard.jsx | Safe access with optional chaining | ✅ Safe |
| OrderDetails.jsx | Safe extraction | ✅ Safe |
| ProductManager.jsx | Direct API response | ⚠️ Needs verification |

---

## 5. PRODUCTION-READY FIXES

### Fix 1: Immediate SQL Script

Run this to fix all existing schemas:

```sql
-- Fix product_types.status for all tenant schemas
DO $$
DECLARE
    schema_record RECORD;
BEGIN
    FOR schema_record IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'tenant_%'
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.product_types ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT %L',
            schema_record.schema_name,
            'active'
        );
        
        EXECUTE format(
            'UPDATE %I.product_types SET status = %L WHERE status IS NULL',
            schema_record.schema_name,
            'active'
        );
        
        RAISE NOTICE 'Fixed product_types in %', schema_record.schema_name;
    END LOOP;
END $$;
```

### Fix 2: Update v1_init.js Migration

Add `status` column to baseline (prevents issue for new tenants):

```javascript
// In migrations/tenant/v1_init.js, line 49-60
`CREATE TABLE IF NOT EXISTS "${s}"."product_types" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "outlet_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(255),
    "icon" VARCHAR(255) DEFAULT '🥬',
    "color" VARCHAR(255) DEFAULT '#10B981',
    "category_id" UUID,
    "status" VARCHAR(50) DEFAULT 'active',  // <-- ADD THIS
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
)`
```

### Fix 3: Enhanced Schema Validator

Update `utils/schemaValidator.js` to check for specific required columns:

```javascript
// Add to TABLE_REQUIRED_COLUMNS in schemaValidator.js
const TABLE_REQUIRED_COLUMNS = {
    'product_types': ['id', 'business_id', 'outlet_id', 'name', 'status', 'created_at', 'updated_at'],
    'products': ['id', 'business_id', 'outlet_id', 'category_id', 'name', 'price', 'is_active', 'created_at', 'updated_at'],
    // ... etc
};
```

### Fix 4: Migration Runner Safety

Update `tenantMigrationService.js` to ensure schema_versions table exists:

```javascript
async ensureSchemaVersionsTable(schemaName, transaction) {
    const exists = await tableExists(schemaName, 'schema_versions');
    if (!exists) {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS "${schemaName}"."schema_versions" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "version" INTEGER NOT NULL,
                "migration_name" VARCHAR(255),
                "description" TEXT,
                "applied_by" VARCHAR(255),
                "applied_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "business_id" UUID,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE("version")
            )
        `, { transaction });
    }
}
```

---

## 6. VERIFICATION SCRIPTS

### Script 1: Audit All Schemas

```bash
node scripts/auditTenantSchemas.js
```

This script checks:
- All tenant schemas exist
- All required tables present
- All required columns present
- Schema versions tracking
- Missing column detection

### Script 2: Fix All Schemas

```bash
node scripts/fixTenantSchemas.js
```

This script:
- Adds missing columns
- Creates schema_versions if missing
- Runs pending migrations
- Generates fix report

---

## 7. CHECKLIST FOR PRODUCTION

### Pre-Deployment
- [ ] Run audit script on production database
- [ ] Review audit report for critical issues
- [ ] Run fix script in staging environment
- [ ] Verify all API endpoints work after fix

### Deployment
- [ ] Backup database
- [ ] Run fix script during maintenance window
- [ ] Monitor error logs for 24 hours

### Post-Deployment
- [ ] Run audit script again to verify fixes
- [ ] Test new tenant onboarding
- [ ] Verify product API calls work
- [ ] Monitor for schema drift

---

## 8. LONG-TERM RECOMMENDATIONS

1. **Add Schema Drift Detection Job**
   - Run daily check comparing all tenant schemas
   - Alert on drift detection

2. **Enhance Monitoring**
   - Track migration failures
   - Monitor schema validation errors

3. **Implement Automatic Recovery**
   - Self-healing migrations
   - Auto-fix for known schema issues

4. **Update Onboarding Validation**
   - Add explicit check for ALL model columns
   - Don't activate tenant until all validations pass

---

## APPENDIX: File Locations

| File | Path |
|------|------|
| Onboarding Service | `services/onboardingService.js` |
| Tenant Model Loader | `src/architecture/tenantModelLoader.js` |
| Schema Validator | `utils/schemaValidator.js` |
| Migration Service | `services/tenantMigrationService.js` |
| Product Type Model | `models/productTypeModel.js` |
| v1 Migration | `migrations/tenant/v1_init.js` |
| v12 Migration | `migrations/tenant/v12_add_product_type_status.js` |
| Audit Script | `scripts/auditTenantSchemas.js` |
| Fix Script | `scripts/fixTenantSchemas.js` |

---

**END OF AUDIT REPORT**
