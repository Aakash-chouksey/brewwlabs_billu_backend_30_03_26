# Backend E2E Test Automation System

## Overview

A comprehensive end-to-end test automation system that validates the entire multi-tenant POS backend lifecycle from scratch.

## 🎯 Purpose

- **Simulate fresh environment**: Test from zero state
- **Validate onboarding**: Ensure tenant creation always works
- **Test authentication**: Verify login and token generation
- **Verify all APIs**: Test all tenant-scoped endpoints
- **Database validation**: Check schema, tables, and data integrity
- **Hidden issue detection**: Find subtle bugs and performance issues
- **CI/CD integration**: Block broken code from reaching production

## 📁 File Structure

```
tests/e2e/
├── config.js                   # Test configuration and constants
├── utils.js                    # Test utilities and helpers
├── index.js                    # Main test orchestrator
├── onboardingTest.js           # Onboarding validation
├── authTest.js                 # Authentication testing
├── tenantAPITest.js            # API endpoint testing
├── databaseVerification.js     # Database state validation
├── hiddenIssueDetector.js    # Hidden issue detection
└── package.json                # Test dependencies
```

## 🚀 Usage

### Run all tests
```bash
cd pos-backend-multitenant-issues-resolved-updatd-code-21-march-2026
node tests/e2e/index.js
```

### Run in CI/CD
```bash
npm run test:e2e:ci
```

## 📊 Test Phases

### Phase 1: Onboarding Test
- Creates new tenant via API
- Validates response structure
- Verifies tenant registry entry
- Checks onboarding completion status

**Success Criteria**:
- ✅ Onboarding API returns success
- ✅ Response has all required fields
- ✅ Tenant registry entry created
- ✅ Status becomes ACTIVE (or CREATING/PENDING for async)

### Phase 2: Authentication Test
- Logs in with created credentials
- Validates token format (JWT)
- Tests protected API access
- Verifies error handling

**Success Criteria**:
- ✅ Login returns valid tokens
- ✅ JWT format is valid
- ✅ Token works for protected endpoints
- ✅ Invalid credentials rejected

### Phase 3: API Test Suite
Tests all tenant APIs:
- /api/tenant/dashboard
- /api/tenant/products
- /api/tenant/orders
- /api/tenant/categories
- /api/tenant/users
- /api/tenant/inventory

**Success Criteria**:
- ✅ All endpoints return 200 OK
- ✅ Response follows contract (success, message, data)
- ✅ No undefined/null crashes
- ✅ Response time < 500ms

### Phase 4: Database Verification
- Verifies public schema tables
- Checks tenant_registry columns
- Validates tenant schema exists
- Verifies required tenant tables
- Checks for misplaced control tables
- Validates default data

**Success Criteria**:
- ✅ All public tables present
- ✅ tenant_registry has all required columns
- ✅ Tenant schema created
- ✅ All tenant tables exist
- ✅ No control tables in tenant schema

### Phase 5: Hidden Issue Detection
- Query parameter serialization
- Error handling patterns
- Silent failure detection
- Performance checks
- Data consistency validation

**Success Criteria**:
- ✅ No [object Object] in responses
- ✅ Proper error messages
- ✅ No 500 errors for client requests
- ✅ API response time < 500ms
- ✅ No orphaned records

## 🔧 Configuration

Edit `tests/e2e/config.js` to customize:

```javascript
const TEST_CONFIG = {
  baseUrl: 'http://localhost:8000',
  timeouts: {
    onboarding: 30000,
    login: 10000,
    api: 10000
  },
  requiredTenantTables: [
    'outlets', 'products', 'orders', 'categories'
  ],
  apiEndpoints: [
    { path: '/api/tenant/dashboard', method: 'GET' }
  ]
};
```

## 📝 Test Results

Tests provide detailed output:

```
=== PHASE 1: TENANT ONBOARDING ===
Step 1: Calling onboarding API
✅ Onboarding API returned success (252ms)
Step 2: Validating onboarding response structure
✅ Response structure is valid
Step 3: Validating required response fields
✅ All required fields present and valid
Step 4: Waiting for onboarding completion
✅ Tenant onboarding completed - status is ACTIVE

=== E2E TEST EXECUTION COMPLETE ===
Test Results by Phase:
  Onboarding:      ✅ PASS
  Authentication:  ✅ PASS
  API Suite:       ✅ PASS
  Database:        ✅ PASS
  Hidden Issues:   ✅ PASS
```

## 🐛 Issue Detection Examples

### Issue 1: Onboarding Failed
```
❌ Tenant onboarding FAILED
Details: {
  status: "INIT_FAILED",
  error: "Schema incomplete: missing 6 required tables"
}
```
**Root Cause**: Background migration not completing
**Fix**: Check migration runner and error handling

### Issue 2: Missing Control Table Columns
```
❌ Tenant Registry Structure: Missing required columns
Details: { missing: ["retry_count", "last_error"] }
```
**Root Cause**: tenant_registry model missing columns
**Fix**: Update model definition and sync

### Issue 3: API Response Contract Violation
```
❌ Response contract validation failed
Details: { issues: ["Missing data field"] }
```
**Root Cause**: API not following response contract
**Fix**: Standardize API responses

### Issue 4: Performance Issue
```
⚠️ Performance: /api/tenant/dashboard is slow (1200ms)
```
**Root Cause**: Slow query or missing indexes
**Fix**: Optimize queries or add database indexes

## 🔒 CI/CD Integration

The system includes GitHub Actions workflow:

```yaml
name: E2E Test Suite
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  e2e-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm start &
      - run: npx wait-on http://localhost:8000/health
      - run: node tests/e2e/index.js
```

## 📈 Exit Codes

- **0**: All tests passed
- **1**: One or more tests failed

## 🎯 Success Criteria

After running the E2E test:

✅ Fresh DB → system works automatically
✅ Tenant onboarding always succeeds
✅ Login always works
✅ All APIs return valid data
✅ No missing columns
✅ No schema issues
✅ No hidden bugs
✅ CI/CD blocks broken code

## 🔍 Debugging Failed Tests

### Check server logs
```bash
cat /tmp/server.log | grep -E "(ERROR|FAILED|Error)"
```

### Check test output
```bash
cat /tmp/e2e-test-output.log
```

### Verify database state
```bash
node -e "
const { sequelize } = require('./config/unified_database');
async function check() {
  const [registry] = await sequelize.query('SELECT * FROM public.tenant_registry');
  console.log(registry);
}
check();
"
```

## 📚 Modules Reference

| Module | Purpose | Key Functions |
|--------|---------|---------------|
| config.js | Test configuration | TEST_CONFIG, TEST_STATE |
| utils.js | Test utilities | TestUtils, TestLogger |
| onboardingTest.js | Onboarding validation | callOnboardingAPI(), checkTenantStatus() |
| authTest.js | Authentication test | login(), validateTokens() |
| tenantAPITest.js | API testing | testEndpoint() |
| databaseVerification.js | DB validation | verifyPublicTables(), verifyTenantSchema() |
| hiddenIssueDetector.js | Issue detection | checkQueryParamIssues(), checkPerformanceIssues() |
| index.js | Orchestrator | run(), generateFinalReport() |

## 🤝 Contributing

When adding new tests:
1. Follow existing module structure
2. Use TestUtils for HTTP requests
3. Use TestLogger for output
4. Update TEST_CONFIG for new endpoints
5. Add test to appropriate phase in orchestrator

## ⚠️ Important Notes

- Tests use dynamic credentials (timestamp-based) to avoid conflicts
- Tests wait 5 seconds after onboarding for background processing
- Database verification requires direct DB connection
- CI/CD uses PostgreSQL service container
- Tests can be run locally with existing server

## 📞 Support

For issues or questions:
1. Check test output for specific failure details
2. Review server logs for error messages
3. Verify database state manually
4. Check configuration in config.js
