const { app } = require('../../app');
const { sequelize: controlPlaneSequelize } = require('../../config/control_plane_db');
const tenantProvisionService = require('../../src/services/tenantProvisionService');

describe('Order and Payment Flow Tests', () => {
    let tenant, userToken, outletId, categoryId, productId, orderId;

    beforeAll(async () => {
        // Setup test environment
        await controlPlaneSequelize.sync({ force: true });
        
        // Create test tenant
        const result = await tenantProvisionService.provisionTenant({
            brandName: 'Order Flow Test',
            ownerEmail: 'order@test.com',
            ownerUserId: 'test-user',
            planId: 'basic-plan',
            clusterId: 'cluster-1'
        });
        tenant = result;

        // Create test user
        userToken = await createTestUser(tenant.brandId);
    });

    afterAll(async () => {
        // Cleanup
        await controlPlaneSequelize.close();
    });

    beforeEach(async () => {
        // Setup test data
        outletId = await createTestOutlet(tenant.brandId, userToken);
        categoryId = await createTestCategory(tenant.brandId, userToken, outletId);
        productId = await createTestProduct(tenant.brandId, userToken, categoryId, outletId);
    });

    describe('Order Creation Flow', () => {
        test('Should create order with items', async () => {
            const orderData = {
                orderNumber: `ORD-${Date.now()}`,
                orderType: 'dine_in',
                outletId: outletId,
                tableId: null,
                items: [
                    {
                        productId: productId,
                        name: 'Test Product',
                        quantity: 2,
                        unitPrice: 10.99,
                        totalPrice: 21.98
                    }
                ],
                subtotal: 21.98,
                taxAmount: 1.76,
                totalAmount: 23.74
            };

            const response = await request(app)
                .post('/api/tenant/orders')
                .set('Authorization', `Bearer ${userToken}`)
                .send(orderData);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBeDefined();
            expect(response.body.data.orderNumber).toBe(orderData.orderNumber);
            expect(response.body.data.status).toBe('pending');
            expect(response.body.data.totalAmount).toBe('23.74');

            orderId = response.body.data.id;
        });

        test('Should validate order data', async () => {
            const invalidOrder = {
                orderNumber: '', // Invalid: empty
                orderType: 'invalid_type',
                items: []
            };

            const response = await request(app)
                .post('/api/tenant/orders')
                .set('Authorization', `Bearer ${userToken}`)
                .send(invalidOrder);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        test('Should update order status', async () => {
            // First create an order
            const order = await createTestOrder(tenant.brandId, userToken, outletId, productId);

            // Update status
            const response = await request(app)
                .put(`/api/tenant/orders/${order.id}/status`)
                .set('Authorization', `Bearer ${userToken}`)
                .send({ status: 'confirmed' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('confirmed');
        });

        test('Should track order status history', async () => {
            // Create order
            const order = await createTestOrder(tenant.brandId, userToken, outletId, productId);

            // Update status multiple times
            await request(app)
                .put(`/api/tenant/orders/${order.id}/status`)
                .set('Authorization', `Bearer ${userToken}`)
                .send({ status: 'confirmed' });

            await request(app)
                .put(`/api/tenant/orders/${order.id}/status`)
                .set('Authorization', `Bearer ${userToken}`)
                .send({ status: 'preparing' });

            // Get status history
            const response = await request(app)
                .get(`/api/tenant/orders/${order.id}/history`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(3); // pending, confirmed, preparing
        });
    });

    describe('Payment Processing Flow', () => {
        beforeEach(async () => {
            // Create order for payment tests
            const order = await createTestOrder(tenant.brandId, userToken, outletId, productId);
            orderId = order.id;
        });

        test('Should process payment successfully', async () => {
            const paymentData = {
                orderId: orderId,
                paymentType: 'cash',
                amount: 23.74,
                notes: 'Cash payment'
            };

            const response = await request(app)
                .post('/api/tenant/payments')
                .set('Authorization', `Bearer ${userToken}`)
                .send(paymentData);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBeDefined();
            expect(response.body.data.paymentType).toBe('cash');
            expect(response.body.data.amount).toBe('23.74');
            expect(response.body.data.status).toBe('completed');
        });

        test('Should validate payment amount', async () => {
            const invalidPayment = {
                orderId: orderId,
                paymentType: 'cash',
                amount: -10.00 // Invalid: negative amount
            };

            const response = await request(app)
                .post('/api/tenant/payments')
                .set('Authorization', `Bearer ${userToken}`)
                .send(invalidPayment);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        test('Should process partial payments', async () => {
            // First partial payment
            const payment1 = await request(app)
                .post('/api/tenant/payments')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    orderId: orderId,
                    paymentType: 'cash',
                    amount: 10.00
                });

            expect(payment1.status).toBe(201);

            // Second partial payment
            const payment2 = await request(app)
                .post('/api/tenant/payments')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    orderId: orderId,
                    paymentType: 'card',
                    amount: 13.74
                });

            expect(payment2.status).toBe(201);

            // Check order status
            const orderResponse = await request(app)
                .get(`/api/tenant/orders/${orderId}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(orderResponse.body.data.payments).toHaveLength(2);
        });

        test('Should handle refunds', async () => {
            // First create a payment
            const payment = await request(app)
                .post('/api/tenant/payments')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    orderId: orderId,
                    paymentType: 'cash',
                    amount: 23.74
                });

            const paymentId = payment.body.data.id;

            // Process refund
            const refundResponse = await request(app)
                .post('/api/tenant/refunds')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    paymentId: paymentId,
                    amount: 10.00,
                    reason: 'Customer requested refund'
                });

            expect(refundResponse.status).toBe(201);
            expect(refundResponse.body.success).toBe(true);
            expect(refundResponse.body.data.amount).toBe('10.00');
            expect(refundResponse.body.data.status).toBe('processed');
        });
    });

    describe('Integration Scenarios', () => {
        test('Complete order lifecycle', async () => {
            // 1. Create order
            const order = await createTestOrder(tenant.brandId, userToken, outletId, productId);
            expect(order.status).toBe('pending');

            // 2. Confirm order
            const confirmed = await request(app)
                .put(`/api/tenant/orders/${order.id}/status`)
                .set('Authorization', `Bearer ${userToken}`)
                .send({ status: 'confirmed' });

            expect(confirmed.body.data.status).toBe('confirmed');

            // 3. Start preparation
            const preparing = await request(app)
                .put(`/api/tenant/orders/${order.id}/status`)
                .set('Authorization', `Bearer ${userToken}`)
                .send({ status: 'preparing' });

            expect(preparing.body.data.status).toBe('preparing');

            // 4. Mark as ready
            const ready = await request(app)
                .put(`/api/tenant/orders/${order.id}/status`)
                .set('Authorization', `Bearer ${userToken}`)
                .send({ status: 'ready' });

            expect(ready.body.data.status).toBe('ready');

            // 5. Process payment
            const payment = await request(app)
                .post('/api/tenant/payments')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    orderId: order.id,
                    paymentType: 'cash',
                    amount: 23.74
                });

            expect(payment.body.data.status).toBe('completed');

            // 6. Complete order
            const completed = await request(app)
                .put(`/api/tenant/orders/${order.id}/status`)
                .set('Authorization', `Bearer ${userToken}`)
                .send({ status: 'completed' });

            expect(completed.body.data.status).toBe('completed');
            expect(completed.body.data.completedAt).toBeDefined();
        });

        test('Multi-outlet order isolation', async () => {
            // Create second outlet
            const outlet2Id = await createTestOutlet(tenant.brandId, userToken, 'Second Outlet');
            
            // Create product in second outlet
            const product2Id = await createTestProduct(tenant.brandId, userToken, categoryId, outlet2Id);

            // Create user with access to only first outlet
            const limitedUserToken = await createTestUserWithOutlet(tenant.brandId, outletId);

            // Try to create order with product from second outlet
            const response = await request(app)
                .post('/api/tenant/orders')
                .set('Authorization', `Bearer ${limitedUserToken}`)
                .send({
                    orderNumber: `ORD-${Date.now()}`,
                    orderType: 'dine_in',
                    outletId: outletId,
                    items: [
                        {
                            productId: product2Id, // Product from inaccessible outlet
                            name: 'Product 2',
                            quantity: 1,
                            unitPrice: 15.99,
                            totalPrice: 15.99
                        }
                    ],
                    totalAmount: 15.99
                });

            expect(response.status).toBe(403);
            expect(response.body.message).toContain('access');
        });

        test('Inventory integration', async () => {
            // Create product with inventory tracking
            const inventoryProduct = await createTestProductWithInventory(
                tenant.brandId, 
                userToken, 
                categoryId, 
                outletId,
                100 // Initial stock
            );

            // Create order that consumes inventory
            const order = await request(app)
                .post('/api/tenant/orders')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    orderNumber: `ORD-${Date.now()}`,
                    orderType: 'dine_in',
                    outletId: outletId,
                    items: [
                        {
                            productId: inventoryProduct,
                            name: 'Inventory Product',
                            quantity: 5,
                            unitPrice: 10.00,
                            totalPrice: 50.00
                        }
                    ],
                    totalAmount: 50.00
                });

            expect(order.status).toBe(201);

            // Complete order to trigger inventory update
            await request(app)
                .put(`/api/tenant/orders/${order.body.data.id}/status`)
                .set('Authorization', `Bearer ${userToken}`)
                .send({ status: 'completed' });

            // Check inventory level
            const inventory = await request(app)
                .get(`/api/tenant/inventory/products/${inventoryProduct}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(inventory.body.data.currentStock).toBe(95); // 100 - 5
        });
    });

    // Helper functions
    async function createTestUser(brandId) {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                email: `user-${Date.now()}@test.com`,
                password: 'password123',
                name: 'Test User',
                businessId: brandId
            });

        return response.body.token;
    }

    async function createTestUserWithOutlet(brandId, outletId) {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                email: `user-${Date.now()}@test.com`,
                password: 'password123',
                name: 'Test User',
                businessId: brandId,
                primaryOutletId: outletId
            });

        return response.body.token;
    }

    async function createTestOutlet(brandId, token, name = 'Test Outlet') {
        const response = await request(app)
            .post('/api/tenant/outlets')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name,
                businessId: brandId
            });

        return response.body.data.id;
    }

    async function createTestCategory(brandId, token, outletId) {
        const response = await request(app)
            .post('/api/tenant/categories')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Test Category',
                businessId: brandId,
                outletId: outletId
            });

        return response.body.data.id;
    }

    async function createTestProduct(brandId, token, categoryId, outletId) {
        const response = await request(app)
            .post('/api/tenant/products')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Test Product',
                price: 10.99,
                businessId: brandId,
                categoryId: categoryId,
                outletId: outletId
            });

        return response.body.data.id;
    }

    async function createTestProductWithInventory(brandId, token, categoryId, outletId, stock) {
        const response = await request(app)
            .post('/api/tenant/products')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Inventory Product',
                price: 10.00,
                businessId: brandId,
                categoryId: categoryId,
                outletId: outletId,
                trackStock: true,
                stock: stock
            });

        return response.body.data.id;
    }

    async function createTestOrder(brandId, token, outletId, productId) {
        const response = await request(app)
            .post('/api/tenant/orders')
            .set('Authorization', `Bearer ${token}`)
            .send({
                orderNumber: `ORD-${Date.now()}`,
                orderType: 'dine_in',
                outletId: outletId,
                items: [
                    {
                        productId: productId,
                        name: 'Test Product',
                        quantity: 2,
                        unitPrice: 10.99,
                        totalPrice: 21.98
                    }
                ],
                subtotal: 21.98,
                taxAmount: 1.76,
                totalAmount: 23.74
            });

        return response.body.data;
    }
});
