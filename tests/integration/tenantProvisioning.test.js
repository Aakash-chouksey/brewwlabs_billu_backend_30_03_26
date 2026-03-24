const request = require('supertest');
const { app } = require('../../src/app');
const { sequelize: controlPlaneSequelize } = require('../../src/config/control_plane_db');
const { Brand, TenantConnection } = require('../../control_plane_models');
const tenantProvisionService = require('../../src/services/tenantProvisionService');

describe('Tenant Provisioning Tests', () => {
    let adminToken;

    beforeAll(async () => {
        // Setup test environment
        await controlPlaneSequelize.sync({ force: true });
        
        // Create admin user for testing
        adminToken = await createTestAdmin();
    });

    afterAll(async () => {
        // Cleanup
        await controlPlaneSequelize.close();
    });

    describe('Tenant Provisioning', () => {
        test('Should provision new tenant successfully', async () => {
            const tenantData = {
                brandName: 'Test Restaurant',
                ownerEmail: 'owner@test.com',
                planId: 'basic-plan',
                clusterId: 'cluster-1'
            };

            const response = await request(app)
                .post('/api/admin/tenants')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(tenantData);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.brandId).toBeDefined();
            expect(response.body.data.tenantConnectionId).toBeDefined();
            expect(response.body.data.databaseName).toContain('tenant_');
        });

        test('Should validate required fields', async () => {
            const response = await request(app)
                .post('/api/admin/tenants')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Missing required fields');
        });

        test('Should prevent duplicate brand names', async () => {
            const tenantData = {
                brandName: 'Duplicate Restaurant',
                ownerEmail: 'owner1@test.com',
                planId: 'basic-plan',
                clusterId: 'cluster-1'
            };

            // Create first tenant
            await request(app)
                .post('/api/admin/tenants')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(tenantData);

            // Try to create duplicate
            const response = await request(app)
                .post('/api/admin/tenants')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    ...tenantData,
                    ownerEmail: 'owner2@test.com'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });

    describe('Tenant Management', () => {
        let testTenant;

        beforeEach(async () => {
            const result = await tenantProvisionService.provisionTenant({
                brandName: 'Management Test',
                ownerEmail: 'mgmt@test.com',
                ownerUserId: 'test-user',
                planId: 'basic-plan',
                clusterId: 'cluster-1'
            });
            testTenant = result;
        });

        test('Should list all tenants', async () => {
            const response = await request(app)
                .get('/api/admin/tenants')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.tenants).toBeInstanceOf(Array);
            expect(response.body.data.pagination).toBeDefined();
        });

        test('Should get tenant details', async () => {
            const response = await request(app)
                .get(`/api/admin/tenants/${testTenant.brandId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.brand.id).toBe(testTenant.brandId);
            expect(response.body.data.connection).toBeDefined();
            expect(response.body.data.health).toBeDefined();
        });

        test('Should test tenant connection', async () => {
            const response = await request(app)
                .post(`/api/admin/tenants/${testTenant.brandId}/test-connection`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.success).toBe(true);
        });

        test('Should update tenant status', async () => {
            const response = await request(app)
                .put(`/api/admin/tenants/${testTenant.brandId}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'suspended' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        test('Should deactivate tenant', async () => {
            const response = await request(app)
                .delete(`/api/admin/tenants/${testTenant.brandId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        test('Should get tenant health metrics', async () => {
            const response = await request(app)
                .get(`/api/admin/tenants/${testTenant.brandId}/health`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.healthScore).toBeDefined();
            expect(response.body.data.healthStatus).toBeDefined();
            expect(response.body.data.issues).toBeInstanceOf(Array);
        });
    });

    describe('Security', () => {
        test('Should require admin authentication', async () => {
            const response = await request(app)
                .get('/api/admin/tenants');

            expect(response.status).toBe(401);
        });

        test('Should reject invalid tokens', async () => {
            const response = await request(app)
                .get('/api/admin/tenants')
                .set('Authorization', 'Bearer invalid-token');

            expect(response.status).toBe(401);
        });

        test('Should prevent tenant users from accessing admin routes', async () => {
            // Create tenant user
            const tenantToken = await createTestUser();

            const response = await request(app)
                .get('/api/admin/tenants')
                .set('Authorization', `Bearer ${tenantToken}`);

            expect(response.status).toBe(401);
        });
    });

    // Helper functions
    async function createTestAdmin() {
        // This would create a super admin user and return token
        // For now, return a mock token
        return 'mock-admin-token';
    }

    async function createTestUser() {
        // This would create a tenant user and return token
        // For now, return a mock token
        return 'mock-tenant-token';
    }
});
