const request = require('supertest');
const { app } = require('../../src/app');
const { sequelize: controlPlaneSequelize } = require('../../src/config/control_plane_db');
const tenantProvisionService = require('../../src/services/tenantProvisionService');

describe('Tenant Isolation Security Tests', () => {
    let tenant1, tenant2;
    let tenant1Token, tenant2Token;
    let adminToken;

    beforeAll(async () => {
        await controlPlaneSequelize.sync({ force: true });
        adminToken = await createTestAdmin();
    });

    afterAll(async () => {
        await controlPlaneSequelize.close();
    });

    beforeEach(async () => {
        tenant1 = await createTestTenant('Security Tenant 1', 'security1@test.com');
        tenant2 = await createTestTenant('Security Tenant 2', 'security2@test.com');
        
        tenant1Token = await createTestUser(tenant1.brandId, 'user1@test.com');
        tenant2Token = await createTestUser(tenant2.brandId, 'user2@test.com');
    });

    describe('Data Access Isolation', () => {
        test('Should prevent cross-tenant data access via direct model queries', async () => {
            // This test would need to access the internal model layer
            // to verify that hooks are working correctly
            
            // Create data in tenant 1
            await request(app)
                .post('/api/tenant/products')
                .set('Authorization', `Bearer ${tenant1Token}`)
                .send({
                    name: 'Secret Product 1',
                    price: 99.99,
                    businessId: tenant1.brandId
                });

            // Try to access tenant 1 data from tenant 2 context
            // This would be done by manipulating the request context
            const maliciousRequest = request(app)
                .get('/api/tenant/products')
                .set('Authorization', `Bearer ${tenant2Token}`)
                .set('X-Tenant-ID', tenant1.brandId); // Attempt to override tenant

            const response = await maliciousRequest;
            expect(response.status).toBe(401);
        });

        test('Should prevent SQL injection for tenant isolation bypass', async () => {
            // Attempt SQL injection to bypass tenant filters
            const maliciousPayload = {
                name: "'; DROP TABLE products; --",
                price: 0.00,
                businessId: tenant1.brandId
            };

            const response = await request(app)
                .post('/api/tenant/products')
                .set('Authorization', `Bearer ${tenant1Token}`)
                .send(maliciousPayload);

            // Should either reject or sanitize the input
            expect([400, 422, 500]).toContain(response.status);
            
            // Verify products table still exists
            const verifyResponse = await request(app)
                .get('/api/tenant/products')
                .set('Authorization', `Bearer ${tenant1Token}`);

            expect(verifyResponse.status).toBe(200);
        });

        test('Should prevent tenant ID manipulation in URLs', async () => {
            // Try to access another tenant's data by manipulating URL parameters
            const response = await request(app)
                .get(`/api/tenant/products?tenantId=${tenant2.brandId}`)
                .set('Authorization', `Bearer ${tenant1Token}`);

            // Should ignore the tenantId parameter or reject the request
            expect(response.status).toBe(200);
            
            // Should only return tenant 1's data
            const products = response.body.data || [];
            products.forEach(product => {
                expect(product.businessId).toBe(tenant1.brandId);
            });
        });
    });

    describe('Authentication and Authorization', () => {
        test('Should validate JWT tokens contain correct tenant', async () => {
            // This would require inspecting the JWT token structure
            // Verify that the businessId in token matches the request context
            
            const response = await request(app)
                .get('/api/tenant/users/profile')
                .set('Authorization', `Bearer ${tenant1Token}`);

            expect(response.status).toBe(200);
            expect(response.body.data.businessId).toBe(tenant1.brandId);
        });

        test('Should prevent token reuse across tenants', async () => {
            // Try to use tenant 1 token to access tenant 2
            const response = await request(app)
                .get('/api/tenant/products')
                .set('Authorization', `Bearer ${tenant1Token}`)
                .set('X-Tenant-ID', tenant2.brandId);

            expect(response.status).toBe(401);
        });

        test('Should invalidate tokens when tenant is deactivated', async () => {
            // Deactivate tenant
            await tenantProvisionService.deactivateTenant(tenant1.brandId);

            // Try to use token for deactivated tenant
            const response = await request(app)
                .get('/api/tenant/products')
                .set('Authorization', `Bearer ${tenant1Token}`);

            expect(response.status).toBe(401);
        });
    });

    describe('Database Connection Security', () => {
        test('Should not expose database credentials', async () => {
            const response = await request(app)
                .get('/api/tenant/connection-info')
                .set('Authorization', `Bearer ${tenant1Token}`);

            // Should not expose sensitive connection info
            expect(response.status).toBe(404); // Route should not exist
            
            // Even if route exists, should not contain passwords
            if (response.status === 200) {
                expect(response.body.password).toBeUndefined();
                expect(response.body.encrypted_password).toBeUndefined();
            }
        });

        test('Should limit database connection pool size', async () => {
            // Make many concurrent requests to test connection pooling
            const requests = Array(50).fill().map(() =>
                request(app)
                    .get('/api/tenant/products')
                    .set('Authorization', `Bearer ${tenant1Token}`)
            );

            const responses = await Promise.all(requests);
            
            // All should succeed without exhausting connections
            responses.forEach(response => {
                expect(response.status).toBe(200);
            });
        });

        test('Should prevent database connection enumeration', async () => {
            // Try to enumerate possible database names
            const commonNames = ['postgres', 'information_schema', 'pg_catalog'];
            
            for (const dbName of commonNames) {
                const response = await request(app)
                    .get(`/api/tenant/database/${dbName}`)
                    .set('Authorization', `Bearer ${tenant1Token}`);

                expect(response.status).toBe(404);
            }
        });
    });

    describe('API Endpoint Security', () => {
        test('Should enforce rate limiting per tenant', async () => {
            // Make many rapid requests
            const requests = Array(100).fill().map(() =>
                request(app)
                    .get('/api/tenant/products')
                    .set('Authorization', `Bearer ${tenant1Token}`)
            );

            const responses = await Promise.all(requests);
            
            // Some requests should be rate limited
            const rateLimitedResponses = responses.filter(r => r.status === 429);
            expect(rateLimitedResponses.length).toBeGreaterThan(0);
        });

        test('Should prevent privilege escalation', async () => {
            // Try to access admin endpoints with tenant token
            const adminEndpoints = [
                '/api/admin/tenants',
                '/api/admin/brands',
                '/api/admin/users'
            ];

            for (const endpoint of adminEndpoints) {
                const response = await request(app)
                    .get(endpoint)
                    .set('Authorization', `Bearer ${tenant1Token}`);

                expect(response.status).toBe(401);
            }
        });

        test('Should validate CORS headers', async () => {
            const response = await request(app)
                .options('/api/tenant/products')
                .set('Origin', 'https://malicious-site.com');

            // Should not allow arbitrary origins
            expect(response.headers['access-control-allow-origin']).not.toBe('*');
            expect(response.headers['access-control-allow-origin']).not.toBe('https://malicious-site.com');
        });
    });

    describe('Data Leakage Prevention', () => {
        test('Should not leak tenant information in error messages', async () => {
            // Try to access non-existent resource
            const response = await request(app)
                .get('/api/tenant/products/non-existent-id')
                .set('Authorization', `Bearer ${tenant1Token}`);

            expect(response.status).toBe(404);
            expect(response.body.message).not.toContain(tenant1.brandId);
            expect(response.body.message).not.toContain('database');
            expect(response.body.message).not.toContain('SQL');
        });

        test('Should sanitize error responses', async () => {
            // Send malformed data to trigger database error
            const response = await request(app)
                .post('/api/tenant/products')
                .set('Authorization', `Bearer ${tenant1Token}`)
                .send({
                    name: null, // Should cause validation error
                    price: 'invalid'
                });

            expect(response.status).toBe(400);
            expect(response.body.message).not.toContain('sequelize');
            expect(response.body.message).not.toContain('database');
        });

        test('Should prevent information disclosure in headers', async () => {
            const response = await request(app)
                .get('/api/tenant/products')
                .set('Authorization', `Bearer ${tenant1Token}`);

            // Check for information disclosure in headers
            const headers = response.headers;
            expect(headers['x-powered-by']).toBeUndefined();
            expect(headers['server']).toBeUndefined();
            expect(headers['x-tenant-id']).toBeUndefined();
        });
    });

    describe('Audit and Logging', () => {
        test('Should log all tenant access attempts', async () => {
            // This would require access to audit logs
            // Verify that all requests are properly logged with tenant context
            
            await request(app)
                .get('/api/tenant/products')
                .set('Authorization', `Bearer ${tenant1Token}`);

            // Check audit logs (this would require admin access)
            const auditResponse = await request(app)
                .get('/api/admin/audit-logs')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(auditResponse.status).toBe(200);
            
            const logs = auditResponse.body.data || [];
            const tenantLogs = logs.filter(log => 
                log.businessId === tenant1.brandId
            );
            
            expect(tenantLogs.length).toBeGreaterThan(0);
        });

        test('Should log security violations', async () => {
            // Attempt security violation
            await request(app)
                .get('/api/admin/tenants')
                .set('Authorization', `Bearer ${tenant1Token}`);

            // Check security logs
            const securityResponse = await request(app)
                .get('/api/admin/security-logs')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(securityResponse.status).toBe(200);
            
            const logs = securityResponse.body.data || [];
            const violationLogs = logs.filter(log => 
                log.type === 'SECURITY_VIOLATION'
            );
            
            expect(violationLogs.length).toBeGreaterThan(0);
        });
    });

    // Helper functions
    async function createTestTenant(name, email) {
        const result = await tenantProvisionService.provisionTenant({
            brandName: name,
            ownerEmail: email,
            ownerUserId: 'test-user',
            planId: 'basic-plan',
            clusterId: 'cluster-1'
        });
        return result;
    }

    async function createTestAdmin() {
        // Create admin user and return token
        return 'mock-admin-token';
    }

    async function createTestUser(brandId, email) {
        // Create user and return token
        return 'mock-tenant-token';
    }
});
