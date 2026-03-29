const assert = require('assert');
const tenantStatusMiddleware = require('./middlewares/tenantStatusMiddleware');
const { TENANT_STATUS } = require('./src/utils/tenantConstants');

// Mock request, response, next
const createMockReq = (businessId, path, role = 'BusinessAdmin') => ({
    businessId,
    path,
    user: { role }
});

const createMockRes = () => ({});

const createMockNext = () => {
    const next = (err) => {
        next.called = true;
        next.error = err;
    };
    next.called = false;
    next.error = null;
    return next;
};

// Mock dependencies
const mockDb = {
    sequelize: {
        models: {
            TenantRegistry: {
                schema: () => ({
                    findOne: async ({ where }) => {
                        if (where.businessId === 'active-id') return { status: 'ACTIVE' };
                        if (where.businessId === 'inactive-id') return { status: 'INACTIVE' };
                        if (where.businessId === 'creating-id') return { status: 'CREATING' };
                        return null;
                    }
                })
            }
        }
    }
};

// Injection for testing (monkey patching)
require('./middlewares/tenantStatusMiddleware');
const fs = require('fs');
const path = require('path');

async function runTests() {
    console.log('🧪 Running TenantStatusMiddleware Verification Tests...');

    // Test 1: Active Tenant
    {
        const req = createMockReq('active-id', '/api/tenant/dashboard');
        const next = createMockNext();
        await tenantStatusMiddleware(req, {}, next);
        assert.strictEqual(next.error, null, 'Active tenant should not have error');
        console.log('✅ Test 1 Passed: Active tenant allowed');
    }

    // Test 2: Inactive Tenant
    {
        const req = createMockReq('inactive-id', '/api/tenant/dashboard');
        const next = createMockNext();
        await tenantStatusMiddleware(req, {}, next);
        assert.ok(next.error, 'Inactive tenant should be blocked');
        assert.strictEqual(next.error.status, 403, 'Inactive tenant should have 403 status');
        console.log('✅ Test 2 Passed: Inactive tenant blocked');
    }

    // Test 3: Creating Tenant (Onboarding)
    {
        const req = createMockReq('creating-id', '/api/tenant/dashboard');
        const next = createMockNext();
        await tenantStatusMiddleware(req, {}, next);
        assert.ok(next.error, 'Creating tenant should be blocked');
        assert.strictEqual(next.error.status, 503, 'Creating tenant should have 503 status');
        console.log('✅ Test 3 Passed: Creating tenant blocked with 503');
    }

    // Test 4: Public Path Bypass
    {
        const req = createMockReq('creating-id', '/api/tenant/status');
        const next = createMockNext();
        await tenantStatusMiddleware(req, {}, next);
        assert.strictEqual(next.error, null, 'Public path should be allowed regardless of status');
        console.log('✅ Test 4 Passed: Public path bypass allowed');
    }

    // Test 5: Super Admin Bypass
    {
        const req = createMockReq('inactive-id', '/api/tenant/dashboard', 'SUPER_ADMIN');
        const next = createMockNext();
        await tenantStatusMiddleware(req, {}, next);
        assert.strictEqual(next.error, null, 'Super Admin should bypass status check');
        console.log('✅ Test 5 Passed: Super Admin bypass allowed');
    }

    console.log('\n✨ All Verification Tests Passed Successfully!');
}

runTests().catch(err => {
    console.error('❌ Tests Failed:', err);
    process.exit(1);
});
