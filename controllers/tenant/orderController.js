/**
 * ORDER CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");
const { Op } = require("sequelize");
const { enforceOutletScope, buildStrictWhereClause } = require("../../utils/outletGuard");
const socketService = require("../../services/socketService");
const { STATUS_FLOW } = require("../../src/config/orderStatuses");
const { BadRequestError } = require("../../utils/errors");
const createError = require("http-errors");

// STATUS_FLOW is now imported from src/config/orderStatuses.js

/**
 * Get all orders
 */
exports.getOrders = async (req, res, next) => {
    try {
        console.log(`� Incoming Request: GET /api/tenant/orders`);
        console.log(`� [OrderController] Fetching orders | Outlet: ${req.headers['x-outlet-id']} | Business: ${req.business_id}`);
        console.log(`🔍 [OrderController] Request query:`, JSON.stringify(req.query, null, 2));
        enforceOutletScope(req);
        const { status, startDate, endDate, limit = 50, offset = 0 } = req.query;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Order, OrderItem, Product, Customer, Table } = models;
            
            const { whereClause } = buildStrictWhereClause(req);
            
            if (status) {
                const statusList = status.split(',');
                whereClause.status = statusList.length > 1 ? { [Op.in]: statusList } : statusList[0];
            }
            if (startDate && endDate) {
                whereClause.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
            }

            return await Order.findAndCountAll({
                where: whereClause,
                include: [
                    { 
                        model: OrderItem, 
                        as: 'items', 
                        include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }] 
                    },
                    { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
                    { model: Table, as: 'table', attributes: ['id', 'name', 'tableNo'] }
                ],
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
        });

        const responseData = result.data ?? result;
        console.log("ORDERS RESPONSE:", responseData?.rows?.length || 0);
        
        res.json({ 
            success: true, 
            data: responseData?.rows ?? [], 
            pagination: {
                total: responseData?.count ?? 0,
                limit: parseInt(limit),
                offset: parseInt(offset)
            },
            message: "Orders retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get order by ID
 */
exports.getOrderById = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { id } = req.params;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Order, OrderItem, Product, Customer, Table, Payment, User } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { id });

            return await Order.findOne({
                where: whereClause,
                include: [
                    { 
                        model: OrderItem, 
                        as: 'items', 
                        include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'price'] }] 
                    },
                    { model: Customer, as: 'customer' },
                    { model: Table, as: 'table', attributes: ['id', 'name', 'tableNo'] },
                    { model: Payment, as: 'payments' },
                    { model: User, as: 'staff', attributes: ['id', 'name', 'email'] }
                ]
            });
        });

        const data = result.data || result;
        if (!data) throw createHttpError(404, "Order not found");
        
        res.json({ 
            success: true, 
            data: data,
            message: "Order retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Add new order
 */
exports.addOrder = async (req, res, next) => {
    try {
        console.log("CREATE ORDER INPUT:", req.body);
        
        enforceOutletScope(req);
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.headers['x-outlet-id'] || req.outlet_id || req.outletId;
        const { customerId, items, type, notes, discount, tax } = req.body;
        const tableId = req.body.tableId || req.body.table;

        // 🚨 STEP 1: FIX ORDER CREATION (MANDATORY TABLE FOR DINE-IN ONLY)
        if (!tableId && type === 'DINE_IN') {
            console.log(`🚨 [OrderController] STEP 1.1: VALIDATION FAILED - Table ID required for Dine-In`);
            throw createHttpError(400, "Table assignment is required for dine-in orders.");
        }
        
        console.log(`🔍 [OrderController] STEP 2: Parsed parameters | Business: ${business_id} | Outlet: ${outlet_id} | Table: ${tableId || 'NONE'} | Type: ${type}`);

        console.log(`🔍 [OrderController] STEP 2: Parsed parameters | Business: ${business_id} | Outlet: ${outlet_id} | Table: ${tableId} | Type: ${type}`);

        if (!items || !Array.isArray(items) || items.length === 0) {
            console.log(`🚨 [OrderController] STEP 3: VALIDATION FAILED - Order items required`);
            throw createHttpError(400, "Order items are required");
        }
        console.log(`🔍 [OrderController] STEP 3: Validation passed - Items count: ${items.length}`);

        const result = await req.executeWithTenant(async (context) => {
            console.log(`🔍 [OrderController] STEP 4: Transaction started`);
            const { transaction, transactionModels: models } = context;
            const { Order, OrderItem, Product, Table } = models;
            
            try {
                // Validate table existence and availability within this tenant/outlet
                if (tableId) {
                    console.log(`🔍 [OrderController] STEP 5: Validating table ${tableId}`);
                    const table = await Table.findOne({
                        where: { id: tableId, businessId: business_id },
                        transaction
                    });
                    if (!table) {
                        console.log(`🚨 [OrderController] STEP 5: TABLE NOT FOUND - Table ID: ${tableId} | Business: ${business_id}`);
                        throw createHttpError(404, "Invalid table selection. Table not found.");
                    }
                    if (table.currentOrderId) {
                        // Verify if the current order is still active
                        const currentOrder = await Order.findOne({
                            where: { 
                                id: table.currentOrderId, 
                                status: { [Op.notIn]: ['COMPLETED', 'CLOSED', 'CANCELLED'] }
                            },
                            transaction
                        });
                        
                        if (!currentOrder) {
                            // Table is marked OCCUPIED but order is not active - auto-correct
                            console.log(`🔧 [OrderController] STEP 5: AUTO-CORRECTING - Table ${tableId} marked OCCUPIED but order ${table.currentOrderId} is not active`);
                            await Table.update(
                                { status: 'AVAILABLE', currentOrderId: null },
                                { where: { id: tableId, businessId: business_id }, transaction }
                            );
                            console.log(`🔧 [OrderController] STEP 5: Table ${tableId} auto-corrected to AVAILABLE`);
                        } else {
                            // Table is genuinely occupied
                            console.log(`🚨 [OrderController] STEP 5: TABLE ALREADY OCCUPIED - Table: ${tableId} | Active Order: ${currentOrder.id}`);
                            throw createHttpError(409, `Table is already occupied by order ${currentOrder.orderNumber}`);
                        }
                    } else if (table.status === 'OCCUPIED') {
                        // Table is marked OCCUPIED but no current order - auto-correct
                        console.log(`🔧 [OrderController] STEP 5: AUTO-CORRECTING - Table ${tableId} marked OCCUPIED but no current order`);
                        await Table.update(
                            { status: 'AVAILABLE' },
                            { where: { id: tableId, businessId: business_id }, transaction }
                        );
                        console.log(`🔧 [OrderController] STEP 5: Table ${tableId} auto-corrected to AVAILABLE`);
                    }
                    console.log(`🔍 [OrderController] STEP 5: Table availability confirmed`);
                }

                // Batch fetch products to avoid N+1 queries
                const productIds = items.map(item => item.productId || item.id);
                
                // Validate product IDs
                if (!productIds.length || productIds.includes(undefined)) {
                    throw createHttpError(400, "Invalid product IDs provided");
                }
                
                console.log(`🔍 [OrderController] STEP 6: Validating products - Product IDs: ${productIds.join(', ')}`);
                const products = await Product.findAll({
                    where: { id: { [Op.in]: productIds }, businessId: business_id },
                    attributes: ['id', 'name', 'price', 'sku', 'isActive'],
                    transaction
                });
                
                console.log(`🔍 [OrderController] STEP 6: Found ${products.length} products`);
                
                const productMap = products.reduce((acc, p) => {
                    acc[p.id] = p;
                    return acc;
                }, {});

                // Calculate totals and prepare order items
                let subtotal = 0;
                const orderItemsRaw = [];

                for (const item of items) {
                    const productId = item.productId || item.id;
                    const product = productMap[productId];
                    if (!product) {
                        console.log(`🚨 [OrderController] STEP 6: PRODUCT NOT FOUND - Product ID: ${productId}`);
                        throw createHttpError(404, `Product ${productId} not found`);
                    }

                    const itemTotal = (Number(product.price) || 0) * (Number(item.quantity) || 0);
                    subtotal += itemTotal;

                    orderItemsRaw.push({
                        productId: productId,
                        name: product.name,
                        quantity: item.quantity,
                        price: product.price,
                        subtotal: itemTotal,
                        notes: item.notes || '',
                        status: item.status || 'PENDING',
                        businessId: business_id,
                        outletId: outlet_id
                    });
                }

                const discountAmount = Number(discount) || 0;
                const taxAmount = Number(tax) || 0;
                const total = subtotal - discountAmount + taxAmount;

                console.log(`🔍 [OrderController] STEP 7: Calculated totals - Subtotal: ${subtotal} | Discount: ${discountAmount} | Tax: ${taxAmount} | Total: ${total}`);

                // Generate order number
                const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                console.log(`🔍 [OrderController] STEP 8: Generated order number: ${orderNumber}`);

                // Create order
                console.log(`🔍 [OrderController] STEP 9: Creating order...`);
                const order = await Order.create({
                    businessId: business_id,
                    outletId: outlet_id,
                    customerId,
                    tableId,
                    orderNumber,
                    type: type || 'DINE_IN',
                    status: 'KOT_SENT', // MANDATORY FIX: status MUST be KOT_SENT
                    billingSubtotal: subtotal,
                    billingDiscount: discountAmount,
                    billingTax: taxAmount,
                    billingTotal: total,
                    notes,
                    staffId: req.user?.id
                }, { transaction });
                
                console.log("CREATED ORDER:", order.toJSON());
                
                // 🚨 STEP 8: ADD DEBUG LOGGING
                console.log("ORDER CREATED:", {
                    id: order.id,
                    status: order.status,
                    tableId
                });
                
                // CRITICAL DEBUG: Log order creation details
                console.log("ORDER CREATED:", {
                    id: order.id,
                    status: order.status,
                    tableId: tableId,
                    businessId: business_id,
                    outletId: outlet_id,
                    orderNumber: orderNumber,
                    timestamp: new Date().toISOString()
                });

                // Create order items
                console.log(`🔍 [OrderController] STEP 10: Creating ${orderItemsRaw.length} order items...`);
                await OrderItem.bulkCreate(
                    orderItemsRaw.map(item => ({ ...item, orderId: order.id })),
                    { transaction }
                );
                console.log(`🔍 [OrderController] STEP 10: Order items created`);

                // Update table status and link order if table assigned
                // 🚨 STEP 4: FIX ORDER → TABLE LINK
                if (tableId) {
                    console.log(`🔍 [OrderController] STEP 11: Updating table ${tableId} status to OCCUPIED...`);
                    await Table.update(
                        { 
                            status: 'OCCUPIED',
                            currentOrderId: order.id
                        },
                        { where: { id: tableId, businessId: business_id }, transaction }
                    );
                    console.log(`🔍 [OrderController] STEP 11: Table database status updated to OCCUPIED`);
                }

                // Final order fetch with items
                const createdOrder = await Order.findByPk(order.id, {
                    include: [
                        { model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] },
                        { model: Table, as: 'table' }
                    ],
                    transaction
                });

                return createdOrder;

            } catch (transactionError) {
                console.log(`🚨 [OrderController] TRANSACTION ERROR: ${transactionError.message}`);
                console.log(`🚨 [OrderController] TRANSACTION STACK: ${transactionError.stack}`);
                // Re-throw to trigger transaction rollback
                throw transactionError;
            }
        });

        const responseData = result.data || result;

        // CRITICAL: Emit socket events AFTER transaction is committed
        // This prevents race conditions where frontend refetches before DB commit
        if (responseData && responseData.id) {
            console.log(`🔍 [OrderController] STEP 13: Emitting post-commit socket events for Order: ${responseData.id}`);
            
            // 1. Emit TABLE_UPDATED if table assigned
            if (responseData.tableId) {
                socketService.emitToOutlet(outlet_id, "TABLE_UPDATED", {
                    tableId: responseData.tableId,
                    status: 'OCCUPIED',
                    orderId: responseData.id,
                    timestamp: new Date().toISOString()
                });
            }

            // 2. Emit ORDER_CREATED
            socketService.emitToOutlet(outlet_id, "ORDER_CREATED", responseData);
            
            // 3. Emit KOT_SENT (since all new orders start as KOT_SENT)
            socketService.emitToOutlet(outlet_id, "KOT_SENT", responseData);
            
            console.log(`📤 Response: Order created successfully`);
            console.log(`🔍 [OrderController] Response data:`, {
                orderId: responseData.id,
                status: responseData.status,
                tableId: responseData.tableId,
                itemCount: responseData.items?.length || 0
            });
            
            console.log(`🔍 [OrderController] STEP 13: Socket events emitted successfully`);
        }

        res.status(201).json({ 
            success: true, 
            data: responseData, 
            message: "Order created successfully" 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update order
 */
exports.updateOrder = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { id } = req.params;
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;
        const { status, items, discount, tax, notes } = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Order, OrderItem, Product, Table } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { id });

            const order = await Order.findOne({
                where: whereClause,
                include: [{ model: OrderItem, as: 'items' }],
                transaction
            });

            if (!order) throw createHttpError(404, "Order not found");

            // VALIDATE STATUS TRANSITION
            if (status) {
                const currentStatus = order.status;
                const allowedNext = STATUS_FLOW[currentStatus] || [];
                
                console.log(`🔍 [OrderController] TRANSITION ATTEMPT: ${currentStatus} -> ${status}`);
                console.log(`🔍 [OrderController] ALLOWED FOR ${currentStatus}:`, JSON.stringify(allowedNext));

                if (!allowedNext.includes(status) && currentStatus !== status) {
                    throw new BadRequestError(`Invalid status transition from ${currentStatus} to ${status}`);
                }
                
                order.status = status;
                if ((status === 'COMPLETED' || status === 'CLOSED' || status === 'CANCELLED') && order.tableId) {
                    console.log(`🔧 [OrderController] STEP: Releasing table ${order.tableId} in database due to order status ${status}`);
                    await Table.update(
                        { 
                            status: 'AVAILABLE',
                            currentOrderId: null
                        },
                        { where: { id: order.tableId, businessId: business_id }, transaction }
                    );
                    console.log(`🔧 [OrderController] STEP: Table ${order.tableId} updated to AVAILABLE in DB`);
                }
            }

            if (items && Array.isArray(items)) {
                await OrderItem.destroy({ where: { orderId: id }, transaction });

                const productIds = items.map(i => i.productId);
                const products = await Product.findAll({
                    where: { id: { [Op.in]: productIds }, businessId: business_id },
                    attributes: ['id', 'name', 'price', 'sku', 'isActive'],
                    transaction
                });
                
                const productMap = products.reduce((acc, p) => {
                    acc[p.id] = p;
                    return acc;
                }, {});

                let subtotal = 0;
                const orderItemsData = [];

                for (const item of items) {
                    const product = productMap[item.productId];
                    if (!product) continue;

                    const itemTotal = (Number(product.price) || 0) * (Number(item.quantity) || 0);
                    subtotal += itemTotal;

                    orderItemsData.push({
                        orderId: id,
                        productId: item.productId,
                        name: product.name,
                        quantity: item.quantity,
                        price: product.price,
                        subtotal: itemTotal,
                        notes: item.notes || '',
                        businessId: business_id,
                        outletId: outlet_id
                    });
                }

                if (orderItemsData.length > 0) {
                    await OrderItem.bulkCreate(orderItemsData, { transaction });
                }

                order.billingSubtotal = subtotal;
                order.billingDiscount = discount !== undefined ? discount : order.billingDiscount;
                order.billingTax = tax !== undefined ? tax : order.billingTax;
                order.billingTotal = order.billingSubtotal - order.billingDiscount + order.billingTax;
            } else {
                if (discount !== undefined) order.billingDiscount = discount;
                if (tax !== undefined) order.billingTax = tax;
                order.billingTotal = (Number(order.billingSubtotal) || 0) - (Number(order.billingDiscount) || 0) + (Number(order.billingTax) || 0);
            }

            if (notes) order.notes = notes;
            await order.save({ transaction });

            const updatedOrder = await Order.findByPk(id, {
                include: [
                    { model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] },
                    { model: Table, as: 'table' }
                ],
                transaction
            });

            return updatedOrder;
        }, { 
            // Optional: Pass context if the executor supports it, 
            // otherwise just check the returned data
        });

        const responseData = result.data || result;
        
        // CRITICAL: Emit TABLE_UPDATED post-commit if table was released
        if (responseData && (responseData.status === 'COMPLETED' || responseData.status === 'CLOSED' || responseData.status === 'CANCELLED') && responseData.tableId) {
            console.log(`🔧 [OrderController] STEP: Emitting post-commit TABLE_UPDATED for Table: ${responseData.tableId}`);
            socketService.emitToOutlet(outlet_id, "TABLE_UPDATED", {
                tableId: responseData.tableId,
                status: 'AVAILABLE',
                orderId: null,
                timestamp: new Date().toISOString()
            });
        }

        // Standard order update emission
        if (responseData) {
            socketService.emitToOutlet(outlet_id, "ORDER_UPDATED", responseData);
        }

        res.json({ 
            success: true, 
            data: responseData, 
            message: "Order updated successfully" 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get archived orders
 */
exports.getArchivedOrders = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { startDate, endDate, limit = 50, offset = 0 } = req.query;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Order, OrderItem, Product, Customer, Table } = models;
            
            const { whereClause } = buildStrictWhereClause(req, {
                status: { [Op.in]: ['COMPLETED', 'CANCELLED', 'ARCHIVED'] }
            });
            
            if (startDate && endDate) {
                whereClause.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
            }

            return await Order.findAndCountAll({
                where: whereClause,
                include: [
                    { 
                        model: OrderItem, 
                        as: 'items', 
                        include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }] 
                    },
                    { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
                    { model: Table, as: 'table', attributes: ['id', 'name', 'tableNo'] }
                ],
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
        });

        const responseData = result.data || result;
        
        res.json({ 
            success: true, 
            data: responseData?.rows ?? [], 
            pagination: {
                total: responseData?.count ?? 0,
                limit: parseInt(limit),
                offset: parseInt(offset)
            },
            message: "Archived orders retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};
