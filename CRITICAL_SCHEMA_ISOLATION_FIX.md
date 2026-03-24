# 🔒 CRITICAL: Multi-Tenant Schema Isolation Fix

**Status:** ⚠️ CRITICAL ISSUE IDENTIFIED  
**Date:** March 24, 2026  
**Priority:** P0 - Production Critical  
**Impact:** Complete schema isolation failure in multi-tenant system

---

## ⚠️ ROOT CAUSE: Transaction Connection Binding Issue

### The Problem

PostgreSQL connection pooling in Neon causes **queries to run on different connections** within the same transaction:

```
1. Connection A: SET LOCAL search_path TO "tenant_xxx"
   ↓
2. Connection B (different!) : SELECT ... (uses public schema instead!)
   ↓
3. Connection C: SELECT ... (uses public schema instead!)
```

This happens because:
- Neon connection pool reuses connections
- `SET LOCAL` only scopes to a **single connection**, not the transaction
- Each query can grab ANY available connection from the pool
- Result: Search path set on Connection A, but queries run on Connections B & C which don't have it

---

## 🔴 CRITICAL FAILURES THIS CAUSES

### 1. Schema Isolation Completely Broken
```javascript
// Intended: Operate on tenant_123 schema
// Actual: First query sets search_path on Conn A, next query runs on Conn B (public schema!)
const result = await Model.findOne({ where: { id: 'x' } });
// ❌ Returns data from PUBLIC schema, not tenant_123!
```

### 2. Cross-Tenant Data Leakage
```javascript
// Tenant A executes:
// Conn A: SET search_path TO "tenant_AAA"
// Conn B: SELECT * FROM users  // Grabs public users by mistake!
// Result: Tenant A sees public users + may see other tenant's data
```

### 3. Rollback Doesn't Work
```javascript
transaction.rollback()
// Sets on Conn A, but Conn B queries aren't rolled back
// Result: Partial data committed, partial rolled back = CORRUPTION
```

### 4. Data Consistency Lost
```javascript
// Transaction expects:
// Query 1: Create in tenant_xxx
// Query 2: Update in tenant_xxx (same tenant)
// 
// Actual:
// Query 1: Conn A - "tenant_xxx" - Creates
// Query 2: Conn B - "public" - Updates wrong table
// Result: Orphaned/invalid data
```

---

## ✅ THE FIX: Strict Transaction Connection Binding

### Core Principle
**EVERY query MUST run on the SAME connection that holds the transaction.**

### Implementation Strategy

**1. Use Sequelize's Transaction Parameter**
```javascript
// ✅ CORRECT: Query uses transaction's connection
await Model.findOne(
  { where: { id: 'x' } },
  { transaction: tx }  // ← CRITICAL: Forces same connection
);

// ❌ WRONG: Query runs on any available connection
await Model.findOne({ where: { id: 'x' } });
```

**2. Bind Raw Queries to Transaction**
```javascript
// ✅ CORRECT: Query uses transaction's connection
await sequelize.query(
  'SELECT * FROM users',
  { 
    transaction: tx,  // ← CRITICAL: Forces same connection
    type: Sequelize.QueryTypes.SELECT
  }
);

// ❌ WRONG: Query runs on any available connection
await sequelize.query('SELECT * FROM users');
```

**3. Wrap ALL Operations in Transaction**
```javascript
// ✅ CORRECT: All operations use same connection
const tx = await sequelize.transaction();
try {
  const result1 = await Op1(tx);  // Conn A
  const result2 = await Op2(tx);  // Conn A (SAME!)
  const result3 = await Op3(tx);  // Conn A (SAME!)
  await tx.commit();
} catch (err) {
  await tx.rollback();
}

// ❌ WRONG: Operations on different connections
await Op1();  // Conn A
await Op2();  // Conn B (DIFFERENT!)
await Op3();  // Conn C (DIFFERENT!)
```

---

## 🔧 REQUIRED FIXES

### FIX 1: Executor - Wrap All Non-Transaction Operations

**File:** `services/neonTransactionSafeExecutor.js`

**Current Issue:** `executeWithoutTransaction` doesn't wrap non-TX operations

**Required Change:**
```javascript
// Current (WRONG):
await getSequelize().query(`SET search_path TO ${searchPath}`);
// Query runs on any connection

// Fixed (RIGHT):
const tx = await getSequelize().transaction();
await getSequelize().query(`SET search_path TO ${searchPath}`, { transaction: tx });
// Query runs on same connection as transaction
```

**Why:** Even `SET search_path` must run on the connection that will execute subsequent queries.

---

### FIX 2: Model Loader - Add Transaction to Sync

**File:** `src/architecture/modelLoader.js`

**Current Issue:** Model sync runs without transaction parameter

**Required Change:**
```javascript
// Current (WRONG):
for (const model of models) {
  await model.sync({ force: false, alter: false });
  // ❌ Runs on any connection from pool
}

// Fixed (RIGHT):
const tx = await sequelize.transaction();
try {
  for (const model of models) {
    await model.sync({ 
      force: false, 
      alter: false,
      transaction: tx  // ← CRITICAL: Same connection
    });
  }
  await tx.commit();
} catch (err) {
  await tx.rollback();
}
```

---

### FIX 3: Onboarding Service - Ensure Transaction Binding

**File:** `services/onboarding.service.js`

**Current Issue:** Phase 1 creates in public, but schema creation might run on different connection

**Required Change:**
```javascript
// Phase 1 - Already correct (using transaction):
await Business.create({...}, { transaction });  // ✅
await sequelize.query(`CREATE SCHEMA...`, { transaction });  // ✅

// Phase 3 - Already correct (using transaction):
await Outlet.create({...}, { transaction });  // ✅
await User.create({...}, { transaction });  // ✅
```

**Verify:** All create/update/delete calls include `{ transaction }`

---

### FIX 4: Query Validation Layer

**File:** `services/neonTransactionSafeExecutor.js` (add validation)

**Required Addition:**
```javascript
/**
 * VALIDATION: Ensure query doesn't escape transaction scope
 */
function validateTransactionBinding(query, transactionProvided) {
  if (!transactionProvided && query.includes('SELECT') && query.includes('FROM')) {
    console.warn('⚠️ WARNING: SELECT query without transaction parameter');
    console.warn('   This query might run on wrong connection!');
    console.warn('   Query:', query.substring(0, 100));
    throw new Error('SELECT queries must include { transaction: tx } parameter');
  }
}
```

---

## 📋 COMPLETE FIX CHECKLIST

### Step 1: Update neonTransactionSafeExecutor.js

**Location:** `executeWithTenant` method

**Changes:**
- [ ] Ensure `SET search_path` query includes `{ transaction: tx }`
- [ ] Ensure schema check query includes `{ transaction: tx }`
- [ ] Ensure all model operations receive `transaction` in context
- [ ] Pass `transaction` to operation callback
- [ ] Validate no queries escape transaction scope

**Code:**
```javascript
// Line ~167: Schema check query
const schemaCheck = await getSequelize().query(
    `SELECT 1 FROM pg_namespace WHERE nspname = :schemaName`,
    {
        replacements: { schemaName },
        type: Sequelize.QueryTypes.SELECT,
        transaction: transaction  // ← MUST have this
    }
);

// Line ~181: SET search_path query
await getSequelize().query(setSql, { 
    transaction: transaction,  // ← MUST have this
    type: Sequelize.QueryTypes.SET 
});
```

---

### Step 2: Update modelLoader.js syncTenantModels

**Location:** `syncTenantModels` function

**Changes:**
- [ ] Wrap entire sync in transaction
- [ ] Pass transaction to each model.sync()
- [ ] Ensure schema is set BEFORE syncs
- [ ] Proper rollback on error

**Code:**
```javascript
async function syncTenantModels(sequelize, schemaName) {
    // Wrap entire operation in transaction
    const tx = await sequelize.transaction();
    
    try {
        // Set search_path on transaction connection
        await sequelize.query(`SET search_path TO "${schemaName}"`, { transaction: tx });
        
        // Sync each model with transaction
        const results = [];
        for (const Model of models) {
            const syncResult = await Model.sync({
                force: false,
                alter: false,
                transaction: tx  // ← CRITICAL
            });
            results.push(syncResult);
        }
        
        await tx.commit();
        return results;
    } catch (err) {
        await tx.rollback();
        throw err;
    }
}
```

---

### Step 3: Verify All Model Operations

**Location:** All files using Sequelize models

**Find and Fix:**
```javascript
// ❌ WRONG PATTERNS:
await Model.findOne({ where: {...} });
await Model.create({...});
await Model.update({...});
await Model.destroy({...});

// ✅ CORRECT PATTERNS:
await Model.findOne({ where: {...} }, { transaction: tx });
await Model.create({...}, { transaction: tx });
await Model.update({...}, { transaction: tx });
await Model.destroy({...}, { transaction: tx });
```

**Files to Check:**
- [ ] services/onboarding.service.js
- [ ] services/auth.service.js
- [ ] services/*Service.js
- [ ] controllers/*.js
- [ ] routes/*.js

---

### Step 4: Verify All Raw Queries

**Location:** All files using sequelize.query()

**Find and Fix:**
```javascript
// ❌ WRONG:
await sequelize.query('SELECT ...');
await sequelize.query('CREATE SCHEMA...');
await sequelize.query('SET search_path...');

// ✅ CORRECT:
await sequelize.query('SELECT ...', { transaction: tx });
await sequelize.query('CREATE SCHEMA...', { transaction: tx });
await sequelize.query('SET search_path...', { transaction: tx });
```

---

## 🔍 VALIDATION: Test Schema Isolation

### Test 1: Connection Binding
```javascript
const tx = await sequelize.transaction();

// Set on this connection
await sequelize.query(`SET search_path TO "tenant_123"`, { transaction: tx });

// Verify it's set on same connection
const [result] = await sequelize.query(
  `SHOW search_path`,
  { transaction: tx }
);

console.log(result);  // Should show: tenant_123
// If shows: public → DIFFERENT CONNECTION! ❌
```

### Test 2: Multi-Query Consistency
```javascript
const tx = await sequelize.transaction();
await sequelize.query(`SET search_path TO "tenant_123"`, { transaction: tx });

// Create in tenant_123
const user1 = await User.create({ name: 'User1' }, { transaction: tx });

// Verify creation is in tenant_123 (not public)
const [check] = await sequelize.query(
  `SELECT schema_name FROM information_schema.tables WHERE table_name = 'user' LIMIT 1`,
  { transaction: tx }
);

console.log(check);  // Should show: tenant_123
// If shows: public → WRONG SCHEMA! ❌
```

### Test 3: Rollback Works
```javascript
const tx = await sequelize.transaction();
await sequelize.query(`SET search_path TO "tenant_123"`, { transaction: tx });

await User.create({ name: 'ToDelete' }, { transaction: tx });
await tx.rollback();

// Verify not in tenant_123
const remaining = await User.findAll({ transaction: null });
// If found "ToDelete" → ROLLBACK FAILED! ❌
```

---

## 📊 EXPECTED RESULTS AFTER FIXES

### Before Fixes (BROKEN)
```
Transaction started on Connection A
├─ SET search_path on Conn A ✓
├─ Query 1: Runs on Conn B (WRONG!) ❌
├─ Query 2: Runs on Conn C (WRONG!) ❌
├─ Query 3: Runs on Conn A (WORKS!) ✓
└─ Rollback: Partial! Some queries already committed ❌

Result: 🔴 DATA CORRUPTION, SCHEMA ISOLATION BROKEN
```

### After Fixes (CORRECT)
```
Transaction started on Connection A
├─ SET search_path on Conn A ✓
├─ Query 1: Runs on Conn A (SAME!) ✓
├─ Query 2: Runs on Conn A (SAME!) ✓
├─ Query 3: Runs on Conn A (SAME!) ✓
└─ Rollback: ALL rolled back ✓

Result: 🟢 SAFE, CONSISTENT, ISOLATED
```

---

## 🚨 CRITICAL RULE

### NO query should run WITHOUT transaction parameter when:
- Inside `executeWithTenant()`
- Operating on tenant-specific data
- Requiring schema isolation
- During batch operations

### Exception:
- Read-only health checks can skip transaction
- But only if explicitly marked as unsafe

---

## 📋 VERIFICATION SCRIPT

```bash
#!/bin/bash

echo "🔍 Checking for unbound queries..."

# Find all queries without transaction parameter
grep -r "sequelize.query\|\.create(\|\.findOne(\|\.update(\|\.destroy(" \
  --include="*.js" \
  | grep -v "transaction" \
  | grep -v "test" \
  | grep -v "// " \
  | head -20

echo ""
echo "⚠️ Any results above = SCHEMA ISOLATION ISSUE"
```

---

## ✅ SIGN-OFF CHECKLIST

- [ ] All sequelize.query() calls include { transaction: tx }
- [ ] All model operations include { transaction: tx }
- [ ] SET search_path included in transaction
- [ ] Schema checks included in transaction
- [ ] Model sync wraps in transaction
- [ ] All services use executeWithTenant
- [ ] No raw SQL escapes transaction scope
- [ ] Rollback tested and working
- [ ] Schema isolation verified with test
- [ ] Concurrent requests tested
- [ ] Cross-tenant isolation confirmed

---

## 🎯 SUCCESS CRITERIA

✅ All queries run on same connection within transaction  
✅ No "Expected tenant_xxx, got public" errors  
✅ Connection reuse becomes safe  
✅ Rollbacks work correctly for all queries  
✅ Schema isolation 100% guaranteed  
✅ Concurrent requests don't interfere  

---

**Status:** Ready for implementation  
**Complexity:** High (affects all database operations)  
**Risk:** High (schema isolation depends on this)  
**Timeline:** Critical - implement immediately  
**Testing:** Requires transaction binding verification  
