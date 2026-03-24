const request = require('supertest');
const jwt = require('jsonwebtoken');
const config = require('../../config/config');

// Test app instance
const app = require('../../app');

describe('Role Segregation Security Tests', () => {
    let superAdminToken;
    let tenantToken;
    let invalidPanelTypeToken;
    let missingPanelTypeToken;

    beforeAll(() => {
        // Create test tokens
        const superAdminPayload = {
            id: 'test-super-admin-id',
            email: 'admin@test.com',
            role: 'SUPER_ADMIN',
            businessId: null,
            tokenVersion: 0,
            panelType: 'ADMIN'
        };
        superAdminToken = jwt.sign(superAdminPayload, config.accessTokenSecret);

        const tenantPayload = {
            id: 'test-tenant-id',
            email: 'tenant@test.com',
            role: 'BusinessAdmin',
            businessId: 'test-business-id',
            tokenVersion: 0,
            panelType: 'TENANT'
        };
        tenantToken = jwt.sign(tenantPayload, config.accessTokenSecret);

        // Invalid panelType token (SuperAdmin with TENANT panelType)
        const invalidPanelTypePayload = {
            id: 'test-invalid-id',
            email: 'invalid@test.com',
            role: 'SUPER_ADMIN',
            businessId: null,
            tokenVersion: 0,
            panelType: 'TENANT' // Invalid: SuperAdmin cannot have TENANT panelType
        };
        invalidPanelTypeToken = jwt.sign(invalidPanelTypePayload, config.accessTokenSecret);

        // Missing panelType token
        const missingPanelTypePayload = {
            id: 'test-missing-id',
            email: 'missing@test.com',
            role: 'BusinessAdmin',
            businessId: 'test-business-id',
            tokenVersion: 0
            // panelType is missing
        };
        missingPanelTypeToken = jwt.sign(missingPanelTypePayload, config.accessTokenSecret);
    });

    describe('Admin Route Protection', () => {
        test('SuperAdmin with ADMIN token should access admin routes', async () => {
            const response = await request(app)
                .get('/api/admin/dashboard')
                .set('Authorization', `Bearer ${superAdminToken}`)
                .expect(404); // Route exists but controller might not be implemented

            // Should not be 403 (forbidden) - route is accessible
            expect(response.status).not.toBe(403);
            expect(response.status).not.toBe(401);
        });

        test('Tenant token should be rejected on admin routes', async () => {
            const response = await request(app)
                .get('/api/admin/dashboard')
                .set('Authorization', `Bearer ${tenantToken}`)
                .expect(403);

            expect(response.body.message).toContain('Access denied');
        });

        test('Invalid panelType token should be rejected on admin routes', async () => {
            const response = await request(app)
                .get('/api/admin/dashboard')
                .set('Authorization', `Bearer ${invalidPanelTypeToken}`)
                .expect(403);

            expect(response.body.message).toContain('Access denied');
        });

        test('Missing panelType token should be rejected on admin routes', async () => {
            const response = await request(app)
                .get('/api/admin/dashboard')
                .set('Authorization', `Bearer ${missingPanelTypeToken}`)
                .expect(401);

            expect(response.body.message).toContain('panelType');
        });
    });

    describe('Tenant Route Protection', () => {
        test('Tenant token should access tenant routes', async () => {
            const response = await request(app)
                .get('/api/tenant/dashboard')
                .set('Authorization', `Bearer ${tenantToken}`)
                .expect(404); // Route exists but controller might not be implemented

            // Should not be 403 (forbidden) - route is accessible
            expect(response.status).not.toBe(403);
            expect(response.status).not.toBe(401);
        });

        test('SuperAdmin token should be rejected on tenant routes', async () => {
            const response = await request(app)
                .get('/api/tenant/dashboard')
                .set('Authorization', `Bearer ${superAdminToken}`)
                .expect(403);

            expect(response.body.message).toContain('Access denied');
        });

        test('Invalid panelType token should be rejected on tenant routes', async () => {
            const response = await request(app)
                .get('/api/tenant/dashboard')
                .set('Authorization', `Bearer ${invalidPanelTypeToken}`)
                .expect(403);

            expect(response.body.message).toContain('Access denied');
        });

        test('Missing panelType token should be rejected on tenant routes', async () => {
            const response = await request(app)
                .get('/api/tenant/dashboard')
                .set('Authorization', `Bearer ${missingPanelTypeToken}`)
                .expect(401);

            expect(response.body.message).toContain('panelType');
        });
    });

    describe('Token Validation Tests', () => {
        test('Modified JWT panelType should be rejected', async () => {
            // Create a valid token and modify it
            const validPayload = {
                id: 'test-modified-id',
                email: 'modified@test.com',
                role: 'BusinessAdmin',
                businessId: 'test-business-id',
                tokenVersion: 0,
                panelType: 'TENANT'
            };
            const validToken = jwt.sign(validPayload, config.accessTokenSecret);
            
            // Decode and modify the token
            const decoded = jwt.decode(validToken);
            decoded.panelType = 'ADMIN'; // Try to elevate privileges
            const modifiedToken = jwt.sign(decoded, config.accessTokenSecret);

            const response = await request(app)
                .get('/api/tenant/dashboard')
                .set('Authorization', `Bearer ${modifiedToken}`)
                .expect(403);

            expect(response.body.message).toContain('Access denied');
        });

        test('Removed panelType should be rejected', async () => {
            const response = await request(app)
                .get('/api/tenant/dashboard')
                .set('Authorization', `Bearer ${missingPanelTypeToken}`)
                .expect(401);

            expect(response.body.message).toContain('Missing or invalid panelType');
        });

        test('Invalid panelType value should be rejected', async () => {
            const invalidValuePayload = {
                id: 'test-invalid-value-id',
                email: 'invalidvalue@test.com',
                role: 'BusinessAdmin',
                businessId: 'test-business-id',
                tokenVersion: 0,
                panelType: 'INVALID' // Invalid panelType
            };
            const invalidValueToken = jwt.sign(invalidValuePayload, config.accessTokenSecret);

            const response = await request(app)
                .get('/api/tenant/dashboard')
                .set('Authorization', `Bearer ${invalidValueToken}`)
                .expect(401);

            expect(response.body.message).toContain('Missing or invalid panelType');
        });
    });

    describe('CORS Domain Isolation Tests', () => {
        test('Admin routes should reject tenant origins', async () => {
            const response = await request(app)
                .get('/api/admin/dashboard')
                .set('Origin', 'https://pos.yourdomain.com')
                .set('Authorization', `Bearer ${superAdminToken}`)
                .expect(403);

            expect(response.status).toBe(403);
        });

        test('Tenant routes should reject admin origins', async () => {
            const response = await request(app)
                .get('/api/tenant/dashboard')
                .set('Origin', 'https://pos-admin.yourdomain.com')
                .set('Authorization', `Bearer ${tenantToken}`)
                .expect(403);

            expect(response.status).toBe(403);
        });

        test('Admin routes should allow admin origins', async () => {
            const response = await request(app)
                .get('/api/admin/dashboard')
                .set('Origin', 'https://pos-admin.yourdomain.com')
                .set('Authorization', `Bearer ${superAdminToken}`)
                .expect(404); // CORS passes, but route might not exist

            expect(response.status).not.toBe(403);
        });

        test('Tenant routes should allow tenant origins', async () => {
            const response = await request(app)
                .get('/api/tenant/dashboard')
                .set('Origin', 'https://pos.yourdomain.com')
                .set('Authorization', `Bearer ${tenantToken}`)
                .expect(404); // CORS passes, but route might not exist

            expect(response.status).not.toBe(403);
        });
    });
});
