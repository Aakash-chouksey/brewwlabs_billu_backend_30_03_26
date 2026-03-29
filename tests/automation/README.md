# Platform-Wide Automation Test System

## Overview

A comprehensive automation test system for the multi-tenant POS platform that validates:
- Database structure and integrity
- Multi-tenant onboarding flow
- Authentication and authorization
- All API endpoints
- Data consistency across layers
- Hidden issues and performance problems

## Quick Start

```bash
# Run full automation test suite
npm run test:automation

# Reset system to clean state (WARNING: Deletes all data)
npm run test:reset

# Run with auto-fix enabled
npm run test:automation:fix

# Run specific test modules
npm run test:reset && npm run test:onboarding
```

## Test Structure

### Core Test Modules

| Module | Description | File |
|--------|-------------|------|
| System Reset | Drops all tenant schemas, clears public tables | `core/testFramework.js` |
| Onboarding Validation | Creates tenant, validates onboarding flow | `core/testFramework.js` |
| Database Structure | Validates schemas, tables, columns | `core/databaseValidation.js` |
| Data Integrity | Checks required data presence | `core/databaseValidation.js` |
| Model Consistency | Validates model↔DB alignment | `core/databaseValidation.js` |
| Auth Validation | Tests login, tokens, middleware | `core/authAndAPITests.js` |
| API Test Suite | Tests all tenant endpoints | `core/authAndAPITests.js` |
| Data Expectation | Compares API expectations vs reality | `core/advancedDetection.js` |
| Hidden Issue Detection | Finds silent failures, misplacements | `core/advancedDetection.js` |
| Root Cause Analysis | Identifies exact failure points | `core/advancedDetection.js` |
| Auto-Fix | Applies code-level fixes | `core/autoFix.js` |

## Detailed Usage

### Full Automation Run

```bash
cd pos-backend-multitenant-issues-resolved-updatd-code-21-march-2026
node tests/automation/runTests.js
```

### With Options

```bash
# Skip system reset (faster for repeated runs)
SKIP_RESET=true node tests/automation/runTests.js

# Skip API tests (database-only validation)
SKIP_API=true node tests/automation/runTests.js

# Disable auto-fix
AUTO_FIX=false node tests/automation/runTests.js
```

### Standalone Scripts

```bash
# Reset system only
node scripts/reset-system.js --force

# Run specific validation
node -e "
  const { DatabaseStructureModule } = require('./tests/automation/core/databaseValidation');
  const module = new DatabaseStructureModule({
    schemaName: 'tenant_test',
    businessId: 'test-business-id'
  });
  module.execute().then(console.log);
"
```

## Test Reports

Reports are generated in `tests/automation/reports/`:
- JSON format: `automation-report-{timestamp}.json`
- HTML format: `automation-report-{timestamp}.html`

View HTML report in browser:
```bash
open tests/automation/reports/automation-report-*.html
```

## Configuration

Create `.env.test` file:

```env
# Test Configuration
TEST_API_URL=http://localhost:8000
DATABASE_URL=postgresql://user:pass@localhost:5432/testdb

# Test Options
SKIP_RESET=false
SKIP_ONBOARDING=false
SKIP_API=false
AUTO_FIX=true

# Timeouts
TEST_TIMEOUT=30000
RETRY_ATTEMPTS=3
```

## What Gets Tested

### 1. System Reset
- ✅ Drops all tenant schemas (tenant_*)
- ✅ Clears public tables (businesses, users, tenant_registry)
- ✅ Resets sequences
- ✅ Clears model caches

### 2. Onboarding Validation
- ✅ Triggers `/api/onboarding/business` endpoint
- ✅ Validates business created in public.businesses
- ✅ Validates tenant_registry entry created
- ✅ Validates schema created (tenant_<uuid>)
- ✅ Waits for background processing
- ✅ Validates status becomes "active" or "CREATING"

### 3. Database Structure
- ✅ tenant_registry exists in public schema
- ✅ Required columns: business_id, schema_name, status, retry_count, last_error
- ✅ Tenant schema exists
- ✅ All expected tables exist in tenant schema
- ✅ No control tables in tenant schema
- ✅ No tenant tables in public schema

### 4. Data Integrity
- ✅ Admin user exists in public.users
- ✅ Outlet exists in tenant schema
- ✅ Settings/config exist
- ✅ Categories exist (if required)
- ✅ Foreign key integrity
- ✅ No orphaned records

### 5. Model Consistency
- ✅ All tenant models load correctly
- ✅ Model attributes match database columns
- ✅ snake_case ↔ camelCase mapping correct
- ✅ No missing required fields
- ✅ Associations configured correctly

### 6. Authentication
- ✅ Login with created user
- ✅ Token generation (JWT)
- ✅ Token structure validation
- ✅ Authenticated request success
- ✅ Token refresh (if available)

### 7. API Test Suite (40+ endpoints)

**Dashboard APIs:**
- GET /api/tenant/dashboard
- GET /api/tenant/analytics/summary
- GET /api/tenant/control-center
- GET /api/tenant/system-health

**Product APIs:**
- GET /api/tenant/products
- GET /api/tenant/product-types
- GET /api/tenant/categories

**Order APIs:**
- GET /api/tenant/orders
- GET /api/tenant/live-orders
- GET /api/tenant/live-stats

**Inventory APIs:**
- GET /api/inventory/items
- GET /api/tenant/inventory-categories
- GET /api/tenant/inventory/dashboard
- GET /api/inventory/suppliers
- GET /api/inventory/low-stock

**Business APIs:**
- GET /api/tenant/business
- GET /api/tenant/outlets
- GET /api/tenant/profile

**Table/Area APIs:**
- GET /api/tenant/tables
- GET /api/tenant/areas

**User APIs:**
- GET /api/tenant/users

**Settings APIs:**
- GET /api/tenant/billing/config
- GET /api/tenant/operation-timings

### 8. Data Expectation Check
- ✅ API response data matches database
- ✅ Required data for each API exists
- ✅ Joins work correctly
- ✅ No broken foreign key references

### 9. Hidden Issue Detection
- ✅ Missing default data
- ✅ Partial onboarding detection
- ✅ Silent transaction failures
- ✅ Raw query issues (missing replacements)
- ✅ Schema misplacement (control tables in tenant)
- ✅ Duplicate model loading
- ✅ Frontend param issues ([object Object])
- ✅ Performance issues (>2s response)

### 10. Root Cause Analysis
- ✅ Identifies exact layer (onboarding/DB/API/model)
- ✅ Pinpoints exact error
- ✅ Identifies missing data/mismatches
- ✅ Suggests code location causing issue

### 11. Auto-Fix
- ✅ Adds missing field mappings to models
- ✅ Creates schema guard for auto-table creation
- ✅ Creates default data seeder
- ✅ Adds onboarding validation
- ✅ Adds API null safety middleware
- ✅ Adds retry logic to migrations
- ✅ Adds null safety to controllers

## Safety Systems Added

The automation system adds these safety mechanisms:

1. **Schema Guard** (`src/utils/schemaGuard.js`)
   - Auto-creates missing schemas
   - Auto-creates missing tables
   - Runs before API operations

2. **Default Data Seeder** (`services/tenant/tenantDataSeeder.js`)
   - Seeds default categories
   - Seeds default areas
   - Seeds inventory categories
   - Runs during onboarding

3. **Onboarding Validator** (`src/utils/onboardingValidator.js`)
   - Validates schema exists
   - Validates required tables
   - Validates required data
   - Blocks activation if invalid

4. **Null Safety Middleware** (`middlewares/nullSafetyMiddleware.js`)
   - Sanitizes undefined values
   - Prevents null pointer crashes
   - Wraps all API responses

## Interpreting Results

### Success Indicators
- All critical steps (onboarding, DB, auth) pass
- API tests: >90% pass rate acceptable
- No critical hidden issues
- No root causes identified

### Warning Indicators
- Warnings in data integrity (missing optional data)
- Slow API responses (>1s)
- Warnings in hidden issue detection

### Failure Indicators
- Onboarding fails
- Database structure invalid
- Authentication fails
- Critical hidden issues found
- Root causes identified

## Troubleshooting

### Test Suite Hangs
```bash
# Check if server is running
curl http://localhost:8000/health

# Reset and restart
node scripts/reset-system.js --force
npm start
```

### Database Connection Failed
```bash
# Verify DATABASE_URL
node -e "console.log(process.env.DATABASE_URL)"

# Test connection
node -e "
const { Sequelize } = require('sequelize');
const s = new Sequelize(process.env.DATABASE_URL, { dialect: 'postgres' });
s.authenticate().then(() => console.log('OK')).catch(console.error);
"
```

### Onboarding Fails
```bash
# Check server logs
tail -f server.log

# Run onboarding only
SKIP_RESET=true SKIP_API=true node tests/automation/runTests.js
```

## CI/CD Integration

```yaml
# .github/workflows/automation-tests.yml
name: Platform Automation Tests

on: [push, pull_request]

jobs:
  automation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:automation
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          TEST_API_URL: http://localhost:8000
```

## Performance Benchmarks

Expected execution times:
- System Reset: 2-5 seconds
- Onboarding: 5-10 seconds
- Database Validation: 3-5 seconds
- API Test Suite: 10-30 seconds
- **Total: 30-60 seconds**

## Contributing

To add new test modules:

1. Create module in `tests/automation/core/`
2. Export class with `execute()` method
3. Import in `runTests.js`
4. Add to orchestrator execution flow
5. Update this README

## Architecture

```
tests/automation/
├── runTests.js              # Main orchestrator
├── core/
│   ├── testFramework.js     # Base utilities, reset, onboarding
│   ├── databaseValidation.js # DB structure, integrity, model check
│   ├── authAndAPITests.js   # Auth, API test suite
│   ├── advancedDetection.js # Hidden issues, root cause
│   └── autoFix.js           # Code-level fixes
├── reports/                 # Generated reports
└── README.md
```

## License

Internal use only - BrewwLabs Platform
