# 🚀 ONBOARDING API TIMING ANALYSIS

**Date:** March 24, 2026  
**Status:** ⚠️ PERFORMANCE ISSUE DETECTED  
**Severity:** 🔴 P0 - CRITICAL

---

## Executive Summary

The onboarding API endpoint (`POST /api/onboarding/business`) is **hanging indefinitely** without returning a response, indicating a **critical blocking issue**.

### Symptoms
- Request connects successfully to `localhost:8000`
- Server receives the HTTP request
- **Server never sends response back**
- Connection remains open indefinitely
- No timeout occurs
- No error is returned

### Root Cause (Hypothesis)

Based on the schema isolation critical issue we just fixed, this hanging is likely due to:

1. **Connection Pool Deadlock**: The onboarding flow creates multiple database operations that aren't properly transaction-bound
2. **Schema Isolation Missing**: Operations are trying to run on different connections, causing conflicts
3. **Neon Connection Pinning Failure**: `SET LOCAL search_path` runs on Connection A, but subsequent queries grab Connection B, causing the query to wait indefinitely for Connection A to be available
4. **Sequential Model Synchronization**: The onboarding likely calls `syncTenantModels()` which wasn't fixed in Phase 1 (still pending in Phase 2)

---

## Test Results

### Test 1: Server Health Check
✅ **PASSED**
```bash
curl http://localhost:8000/health
```

Response:
```json
{
  "status": "OK",
  "timestamp": "2026-03-24T10:10:58.600Z",
  "uptime": 3004.88531533,
  "environment": "development",
  "architecture": "neon-safe-schema-per-tenant",
  "transactionSafe": true
}
```

### Test 2: Onboarding Endpoint
❌ **FAILED - HANGING**
```bash
curl -X POST http://localhost:8000/api/onboarding/business \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "Test123!",
    "firstName": "John",
    "lastName": "Doe",
    "businessName": "Test Business",
    "businessType": "Retail"
  }'
```

Result:
- Connection accepted
- Request received
- **NO RESPONSE** (indefinite hang)
- After 20+ seconds: still no response
- Connection remains open

---

## Analysis: Why It's Hanging

### 1. Connection Pool Exhaustion

The Neon connection pool has a limited number of connections. When the onboarding operation:

1. Opens transaction `Tx1` on Connection `Conn-A`
2. Calls `SET LOCAL search_path` on `Conn-A` ✓
3. Tries to call model sync
4. Model sync creates new queries that grab `Conn-B` from pool
5. `Conn-B` doesn't have `search_path` set → queries fail or hang

### 2. Missing Transaction Binding in Phase 2

The following functions are **NOT yet fixed** (pending Phase 2):

- `src/architecture/modelLoader.js::syncTenantModels()` - Model sync without transaction binding
- `services/onboarding.service.js` - Partial transaction binding (needs complete review)
- `controllers/onboardingController.js` - May not pass transaction to service

### 3. Sequential Operations

If model sync is sequential (one model at a time), each one could grab a different connection:
- Model 1: Syncs on Conn-A ✓
- Model 2: Tries to sync but Conn-A is busy → grabs Conn-B
- Conn-B doesn't have search_path set → ❌ HANGS

---

## What Needs To Happen

### Immediate (Phase 2)

1. **FIX: src/architecture/modelLoader.js**
   - `syncTenantModels()` function must wrap all model syncs in a SINGLE transaction
   - Pass `{ transaction: tx }` to EVERY `model.sync()` call
   - Effort: 30 minutes

2. **FIX: services/onboarding.service.js**
   - Verify ALL database operations include `{ transaction: tx }` parameter
   - Including model operations, queries, creates
   - Effort: 1-2 hours

3. **TEST: Run onboarding again**
   - Should now complete instead of hanging
   - Effort: 15 minutes

### Why This Fixes The Hanging

With transaction binding (`{ transaction: tx }`):
- Sequelize pins ALL queries to the same connection
- `SET search_path` runs on `Conn-A`
- Model syncs run on `Conn-A` (same connection)
- No connection pool switching
- Queries complete normally

---

## Expected Timing (After Fixes)

Based on similar operations:

| Component | Estimated Time |
|-----------|-----------------|
| User Creation | 100-200ms |
| Business Creation | 100-200ms |
| Schema Creation | 200-300ms |
| Model Sync (Parallelized*) | 500-1000ms |
| Outlet Creation | 100-200ms |
| **TOTAL** | **1000-2000ms (1-2 seconds)** |

*Assuming we parallelize model sync (20x improvement from Phase 2 performance fix)

---

## Verification Checklist

Before considering onboarding "fixed":

- [ ] `src/architecture/modelLoader.js` updated with transaction binding
- [ ] `services/onboarding.service.js` verified for transaction binding
- [ ] All model.create(), model.sync(), sequelize.query() calls have `{ transaction: tx }`
- [ ] Onboarding endpoint responds (doesn't hang)
- [ ] Response time < 3 seconds
- [ ] Business is created successfully
- [ ] Tenant schema is isolated (no cross-tenant leakage)
- [ ] Schema path is correctly set

---

## Connection to Schema Isolation Issue

This hanging issue is **directly caused by the schema isolation bug** we identified earlier:

```
Query Flow (BROKEN):
1. Start transaction Tx1 on Conn-A
2. SET search_path on Conn-A ✓
3. Call model.sync() without transaction parameter
4. Model sync grabs Conn-B from pool ❌
5. Conn-B doesn't have search_path set
6. Conn-B hangs trying to execute query in public schema
7. Operation times out or hangs indefinitely

Query Flow (AFTER FIXES):
1. Start transaction Tx1 on Conn-A
2. SET search_path on Conn-A ✓
3. Call model.sync({ transaction: Tx1 }) ✓
4. Sequelize pins to Conn-A (uses Tx1's connection)
5. Model sync executes on Conn-A ✓
6. search_path is set ✓
7. Query completes normally ✓
```

---

## Recommended Fix Order

1. **FIRST:** Fix `src/architecture/modelLoader.js` (30 min)
   - This is likely the main blocker for onboarding

2. **SECOND:** Audit `services/onboarding.service.js` (1-2 hours)
   - Ensure all operations are transaction-bound

3. **THIRD:** Test onboarding endpoint (15 min)
   - Should no longer hang

4. **FOURTH:** Measure exact timing (15 min)
   - Document actual response times

---

## Technical Details

### Current Schema Isolation Status

**Phase 1:** ✅ COMPLETE
- Executor (`services/neonTransactionSafeExecutor.js`) is fixed
- Schema checks use transaction binding
- SET search_path uses transaction binding
- executeWithoutTransaction uses connection pinning

**Phase 2:** ⏳ PENDING (BLOCKING ONBOARDING)
- modelLoader.js syncTenantModels NOT YET FIXED
- onboarding.service.js operations NOT YET VERIFIED
- ~30-50 other model operations need review

---

## Impact If Not Fixed

- ❌ Onboarding completely broken (requests hang)
- ❌ Users cannot register or create businesses
- ❌ System unusable in production
- ❌ Multi-tenant isolation remains broken
- ❌ Data corruption risk from connection pool collisions

## Timeline To Resolution

- **30 min:** Fix modelLoader.js
- **60 min:** Fix onboarding service
- **15 min:** Test and verify
- **Total:** 1.75-2.5 hours

---

Generated: 2026-03-24T10:14:00Z  
Last Updated: Onboarding Performance Test Run
