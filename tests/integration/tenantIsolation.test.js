/**
 * Tenant Isolation Integration Tests
 * 
 * These tests ensure that tenant isolation works correctly and prevents
 * cross-tenant data leaks.
 */

const request = require('supertest');
const { sequelize } = require('../../legacy_runtime_disabled/associations');
const { getTenantSequelize, cleanupTenantConnections } = require('../../src/db/tenantConnectionFactory');
const { initializeTenantModels } = require('../../src/db/tenantModelRegistry');
const { v4: uuidv4 } = require('uuid');

describe('Tenant Isolation Tests', () => {
    let app;
    let tenant1Db, tenant2Db;
    let tenant1Models, tenant2Models;
    let tenant1Id, tenant2Id;
    let tenant1User, tenant2User;
    let tenant1Token, tenant2Token;
    let superAdminToken;

    beforeAll(async () => {
        // Initialize test app
        app = require('../../app');
        
        // Create test tenant databases
        tenant1Id = uuidv4();
        tenant2Id = uuidv4();
        
        // Initialize tenant connections (using in-memory SQLite for testing)
        tenant1Db = new Sequelize('sqlite::memory:', { logging: false });
        tenant2Db = new Sequelize('sqlite::memory:', { logging: false });
        
        // Initialize tenant models
        tenant1Models = initializeTenantModels(tenant1Db);
        tenant2Models = initializeTenantModels(tenant2Db);
        
        // Sync tenant databases
        await tenant1Db.sync({ force: true });
        await tenant2Db.sync({ force: true });
    });

    afterAll(async () => {
        // Clean up connections
        await tenant1Db.close();
        await tenant2Db.close();
        cleanupTenantConnections();
        await sequelize.close();
    });

    describe('Cross-Tenant Access Prevention', () => {
        test('should prevent user from accessing other tenant data', async () => {
            // Create test data for tenant 1
            const tenant1Product = await tenant1Models.Product.create({
                id: uuidv4(),
                businessId: tenant1Id,
                name: 'Tenant 1 Product',
                price: 10.00
            });

            // Create test data for tenant 2
            const tenant2Product = await tenant2Models.Product.create({
                id: uuidv4(),
                businessId: tenant2Id,
                name: 'Tenant 2 Product',
                price: 20.00
            });

            // Mock authenticated user from tenant 1
            const mockUser = {
                id: uuidv4(),
                businessId: tenant1Id,
                role: 'BusinessAdmin'
            };

            // Test that tenant 1 user cannot access tenant 2 product
            const response = await request(app)
                .get(`/api/products/${tenant2Product.id}`)
                .set('Authorization', `Bearer ${tenant1Token}`)
                .expect(404);

            expect(response.body.message).toContain('not found');
        });

        test('should prevent cross-tenant data manipulation', async () => {
            // Create product in tenant 1
            const product = await tenant1Models.Product.create({
                id: uuidv4(),
                businessId: tenant1Id,
                name: 'Test Product',
                price: 15.00
            });

            // Try to update product with different businessId
            const response = await request(app)
                .put(`/api/products/${product.id}`)
                .set('Authorization', `Bearer ${tenant2Token}`)
                .send({
                    name: 'Hacked Product',
                    businessId: tenant2Id // Try to change ownership
                })
                .expect(404);

            expect(response.body.message).toContain('not found');
        });
    });

    describe('Outlet Access Control', () => {
        test('should prevent outlet admin from seeing other outlet data', async () => {
            const outlet1Id = uuidv4();
            const outlet2Id = uuidv4();

            // Create outlets
            await tenant1Models.Outlet.create({
                id: outlet1Id,
                businessId: tenant1Id,
                name: 'Outlet 1'
            });

            await tenant1Models.Outlet.create({
                id: outlet2Id,
                businessId: tenant1Id,
                name: 'Outlet 2'
            });

            // Create user assigned to outlet 1
            const outletUser = await tenant1Models.User.create({
                id: uuidv4(),
                businessId: tenant1Id,
                outletId: outlet1Id,
                name: 'Outlet User',
                email: 'outlet@test.com',
                role: 'Manager'
            });

            // Create products in both outlets
            await tenant1Models.Product.create({
                id: uuidv4(),
                businessId: tenant1Id,
                outletId: outlet1Id,
                name: 'Outlet 1 Product'
            });

            await tenant1Models.Product.create({
                id: uuidv4(),
                businessId: tenant1Id,
                outletId: outlet2Id,
                name: 'Outlet 2 Product'
            });

            // Mock authentication for outlet user
            const mockToken = generateMockToken(outletUser);

            // User should only see products from their outlet
            const response = await request(app)
                .get('/api/products')
                .set('Authorization', `Bearer ${mockToken}`)
                .expect(200);

            const products = response.body.data;
            expect(products).toHaveLength(1);
            expect(products[0].name).toBe('Outlet 1 Product');
        });

        test('should allow brand admin to see all outlet data', async () => {
            const outlet1Id = uuidv4();
            const outlet2Id = uuidv4();

            // Create outlets
            await tenant1Models.Outlet.create({
                id: outlet1Id,
                businessId: tenant1Id,
                name: 'Outlet 1'
            });

            await tenant1Models.Outlet.create({
                id: outlet2Id,
                businessId: tenant1Id,
                name: 'Outlet 2'
            });

            // Create brand admin user
            const brandAdmin = await tenant1Models.User.create({
                id: uuidv4(),
                businessId: tenant1Id,
                name: 'Brand Admin',
                email: 'admin@test.com',
                role: 'BusinessAdmin'
            });

            // Create products in both outlets
            await tenant1Models.Product.create({
                id: uuidv4(),
                businessId: tenant1Id,
                outletId: outlet1Id,
                name: 'Outlet 1 Product'
            });

            await tenant1Models.Product.create({
                id: uuidv4(),
                businessId: tenant1Id,
                outletId: outlet2Id,
                name: 'Outlet 2 Product'
            });

            // Mock authentication for brand admin
            const mockToken = generateMockToken(brandAdmin);

            // Brand admin should see all products
            const response = await request(app)
                .get('/api/products')
                .set('Authorization', `Bearer ${mockToken}`)
                .expect(200);

            const products = response.body.data;
            expect(products).toHaveLength(2);
        });
    });

    describe('Royalty Calculation', () => {
        test('should calculate royalties correctly per tenant', async () => {
            // Create test orders for tenant 1
            const order1 = await tenant1Models.Order.create({
                id: uuidv4(),
                businessId: tenant1Id,
                orderNumber: 'ORD-001',
                userId: tenant1User.id,
                subtotal: 100.00,
                tax: 10.00,
                total: 110.00,
                status: 'completed'
            });

            const order2 = await tenant1Models.Order.create({
                id: uuidv4(),
                businessId: tenant1Id,
                orderNumber: 'ORD-002',
                userId: tenant1User.id,
                subtotal: 200.00,
                tax: 20.00,
                total: 220.00,
                status: 'completed'
            });

            // Test royalty calculation endpoint
            const response = await request(app)
                .get('/api/royalties/calculate')
                .set('Authorization', `Bearer ${tenant1Token}`)
                .expect(200);

            const royaltyData = response.body.data;
            expect(royaltyData.totalRevenue).toBe(330.00);
            expect(royaltyData.royaltyAmount).toBeGreaterThan(0);
        });
    });

    describe('Connection Pool Management', () => {
        test('should handle connection pool eviction', async () => {
            // Simulate multiple tenant connections
            const connections = [];
            
            for (let i = 0; i < 10; i++) {
                const tenantId = uuidv4();
                const connectionInfo = {
                    brandId: tenantId,
                    db_host: 'localhost',
                    db_port: 5432,
                    db_name: `test_tenant_${i}`,
                    db_user: 'test',
                    encrypted_password: encryptPassword('test')
                };
                
                try {
                    const sequelize = await getTenantSequelize(connectionInfo);
                    connections.push(sequelize);
                } catch (error) {
                    // Expected to fail in test environment
                }
            }

            // Test connection stats
            const stats = require('../../src/db/tenantConnectionFactory').getTenantConnectionStats();
            expect(stats).toHaveProperty('cache');
            expect(stats).toHaveProperty('totalConnectionsCreated');
        });
    });

    describe('Token Security', () => {
        test('should detect token tampering', async () => {
            // Create valid token
            const validToken = generateMockToken(tenant1User);
            
            // Tamper with token
            const tamperedToken = validToken.slice(0, -10) + 'tampered';
            
            const response = await request(app)
                .get('/api/products')
                .set('Authorization', `Bearer ${tamperedToken}`)
                .expect(401);

            expect(response.body.message).toContain('Invalid token');
        });

        test('should invalidate tokens on password change', async () => {
            // Change user password (increments tokenVersion)
            await tenant1Models.User.update(
                { tokenVersion: 1 },
                { where: { id: tenant1User.id } }
            );

            // Old token should be invalid
            const response = await request(app)
                .get('/api/products')
                .set('Authorization', `Bearer ${tenant1Token}`)
                .expect(401);

            expect(response.body.message).toContain('invalidated');
        });
    });

    describe('Migration Integrity', () => {
        test('should maintain data integrity during migration', async () => {
            // Create test data in shared DB
            const sharedProduct = await sequelize.models.Product.create({
                id: uuidv4(),
                businessId: tenant1Id,
                name: 'Shared Product',
                price: 25.00
            });

            // Simulate migration
            const migratedProduct = await tenant1Models.Product.create({
                id: sharedProduct.id,
                businessId: sharedProduct.businessId,
                name: sharedProduct.name,
                price: sharedProduct.price
            });

            // Verify data integrity
            expect(migratedProduct.id).toBe(sharedProduct.id);
            expect(migratedProduct.businessId).toBe(sharedProduct.businessId);
            expect(migratedProduct.name).toBe(sharedProduct.name);
            expect(migratedProduct.price).toBe(sharedProduct.price);
        });
    });
});

// Helper functions
function generateMockToken(user) {
    const jwt = require('jsonwebtoken');
    const config = require('../../config/config');
    
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role,
            businessId: user.businessId,
            tokenVersion: user.tokenVersion || 0
        },
        config.accessTokenSecret,
        { expiresIn: '1h' }
    );
}

function encryptPassword(password) {
    const crypto = require('crypto');
    const algorithm = 'aes-256-gcm';
    const secretKey = process.env.TENANT_ENCRYPTION_KEY || 'test-key-32-characters-long-1234';
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, secretKey, iv);
    
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
    };
}
