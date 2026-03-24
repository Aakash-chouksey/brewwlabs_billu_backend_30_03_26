/**
 * ORDER CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");
const { Op } = require("sequelize");
const { enforceOutletScope, buildStrictWhereClause } = require("../utils/outletGuard");
const { safeQuery } = require("../utils/safeQuery");

/**
 * Get all orders
 */
exports.getOrders = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { businessId } = req;
        const { status, startDate, endDate, limit = 50, offset = 0 } = req.query;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Order, OrderItem, Product, Customer, Table } = models;
            
            // Build strict where clause with MANDATORY outlet filtering
            const { whereClause } = buildStrictWhereClause(req);
            
            if (status) whereClause.status = status;
            if (startDate && endDate) {
                whereClause.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
            }

            // Phase 2: Safe findAndCountAll
            return await safeQuery(
                () => Order.findAndCountAll({
                    where: whereClause,
                    include: [
                        { 
                            model: OrderItem, 
                            as: 'items', 
                            include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }] 
                        },
                        { model: Customer, attributes: ['id', 'name', 'phone'] },
                        { model: Table, attributes: ['id', 'name', 'number'] }
                    ],
                    order: [['createdAt', 'DESC']],
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                }),
                { rows: [], count: 0 }
            );
        });

        res.json({ 
            success: true, 
            data: result?.rows || [], 
            pagination: {
                total: result?.count || 0,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
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
            
            // Build strict where clause with MANDATORY outlet filtering
            const { whereClause } = buildStrictWhereClause(req, { id });

            return await safeQuery(
                () => Order.findOne({
                    where: whereClause,
                    include: [
                        { 
                            model: OrderItem, 
                            as: 'items', 
                            include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'price'] }] 
                        },
                        { model: Customer },
                        { model: Table, attributes: ['id', 'name', 'number'] },
                        { model: Payment },
                        { model: User, as: 'staff', attributes: ['id', 'name', 'email'] }
                    ]
                }),
                null
            );
        });

        if (!result) throw createHttpError(404, "Order not found");
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

/**
 * Add new order
 */
exports.addOrder = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { businessId, outletId } = req;
        const { customerId, tableId, items, type, notes, discount, tax } = req.body;

        // Early validation
        if (!businessId || !outletId) {
            throw createHttpError(400, "🚨 Business ID and Outlet ID are required");
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            throw createHttpError(400, "Order items are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Order, OrderItem, Product, Table, Customer } = models;
            
            // Calculate totals
            let subtotal = 0;
            const orderItemsRaw = [];

            for (const item of items) {
                const product = await safeQuery(
                    () => Product.findOne({
                        where: { id: item.productId, businessId },
                        transaction
                    }),
                    null
                );
                
                if (!product) throw createHttpError(404, `Product ${item.productId} not found`);

                const itemTotal = (Number(product.price) || 0) * (Number(item.quantity) || 0);
                subtotal += itemTotal;

                orderItemsRaw.push({
                    productId: item.productId,
                    name: product.name,
                    quantity: item.quantity,
                    price: product.price,
                    subtotal: itemTotal,
                    notes: item.notes || '',
                    status: item.status || 'PENDING',
                    businessId
                });
            }

            const discountAmount = Number(discount) || 0;
            const taxAmount = Number(tax) || 0;
            const total = subtotal - discountAmount + taxAmount;

            // Generate order number (Basic fallback)
            const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            // Create order
            const order = await Order.create({
                businessId,
                outletId,
                customerId,
                tableId,
                orderNumber, // Required in newer model
                type: type || 'DINE_IN',
                status: 'PENDING',
                billing_subtotal: subtotal,
                billing_discount: discountAmount,
                billing_tax: taxAmount,
                billing_total: total,
                notes,
                staffId: req.auth?.id
            }, { transaction });

            // Create order items
            await OrderItem.bulkCreate(
                orderItemsRaw.map(item => ({ ...item, orderId: order.id })),
                { transaction }
            );

            // Update table status if table assigned
            if (tableId) {
                await safeQuery(
                    () => Table.update(
                        { status: 'OCCUPIED' },
                        { where: { id: tableId, businessId }, transaction }
                    ),
                    [0]
                );
            }

            return await safeQuery(
                () => Order.findByPk(order.id, {
                    include: [
                        { model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] },
                        { model: Table }
                    ],
                    transaction
                }),
                order
            );
        });

        res.status(201).json({ success: true, data: result, message: "Order created" });
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
        const { businessId } = req;
        const { status, items, discount, tax, notes } = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Order, OrderItem, Product, Table } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { id });

            const order = await safeQuery(
                () => Order.findOne({
                    where: whereClause,
                    include: [{ model: OrderItem, as: 'items' }],
                    transaction
                }),
                null
            );

            if (!order) throw createHttpError(404, "Order not found");

            if (status) {
                order.status = status;
                if ((status === 'COMPLETED' || status === 'CANCELLED') && order.tableId) {
                    await safeQuery(
                        () => Table.update(
                            { status: 'AVAILABLE' },
                            { where: { id: order.tableId, businessId }, transaction }
                        ),
                        [0]
                    );
                }
            }

            if (items && Array.isArray(items)) {
                await OrderItem.destroy({ where: { orderId: id }, transaction });

                let subtotal = 0;
                for (const item of items) {
                    const product = await safeQuery(
                        () => Product.findOne({
                            where: { id: item.productId, businessId },
                            transaction
                        }),
                        null
                    );
                    
                    if (!product) continue;

                    const itemTotal = (Number(product.price) || 0) * (Number(item.quantity) || 0);
                    subtotal += itemTotal;

                    await OrderItem.create({
                        orderId: id,
                        productId: item.productId,
                        name: product.name,
                        quantity: item.quantity,
                        price: product.price,
                        subtotal: itemTotal,
                        notes: item.notes || '',
                        businessId
                    }, { transaction });
                }

                order.billing_subtotal = subtotal;
                order.billing_discount = discount !== undefined ? discount : order.billing_discount;
                order.billing_tax = tax !== undefined ? tax : order.billing_tax;
                order.billing_total = order.billing_subtotal - order.billing_discount + order.billing_tax;
            } else {
                if (discount !== undefined) order.billing_discount = discount;
                if (tax !== undefined) order.billing_tax = tax;
                order.billing_total = (Number(order.billing_subtotal) || 0) - (Number(order.billing_discount) || 0) + (Number(order.billing_tax) || 0);
            }

            if (notes) order.notes = notes;
            await order.save({ transaction });

            return await safeQuery(
                () => Order.findByPk(id, {
                    include: [
                        { model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] },
                        { model: Table }
                    ],
                    transaction
                }),
                order
            );
        });

        res.json({ success: true, data: result, message: "Order updated" });
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
        const { businessId } = req;
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

            return await safeQuery(
                () => Order.findAndCountAll({
                    where: whereClause,
                    include: [
                        { 
                            model: OrderItem, 
                            as: 'items', 
                            include: [{ model: Product, attributes: ['id', 'name'] }] 
                        },
                        { model: Customer, attributes: ['id', 'name', 'phone'] },
                        { model: Table, attributes: ['id', 'name', 'number'] }
                    ],
                    order: [['createdAt', 'DESC']],
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                }),
                { rows: [], count: 0 }
            );
        });

        res.json({ 
            success: true, 
            data: result?.rows || [], 
            pagination: {
                total: result?.count || 0,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
    } catch (error) {
        next(error);
    }
};
