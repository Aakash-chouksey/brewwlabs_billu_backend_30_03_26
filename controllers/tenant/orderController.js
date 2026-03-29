/**
 * ORDER CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");
const { Op } = require("sequelize");
const { enforceOutletScope, buildStrictWhereClause } = require("../../utils/outletGuard");

/**
 * Get all orders
 */
exports.getOrders = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { status, startDate, endDate, limit = 50, offset = 0 } = req.query;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Order, OrderItem, Product, Customer, Table } = models;
            
            const { whereClause } = buildStrictWhereClause(req);
            
            if (status) whereClause.status = status;
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
        enforceOutletScope(req);
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;
        const { customerId, tableId, items, type, notes, discount, tax } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            throw createHttpError(400, "Order items are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Order, OrderItem, Product, Table } = models;
            
            // Batch fetch products to avoid N+1 queries
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

            // Calculate totals and prepare order items
            let subtotal = 0;
            const orderItemsRaw = [];

            for (const item of items) {
                const product = productMap[item.productId];
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
                    businessId: business_id,
                    outletId: outlet_id
                });
            }

            const discountAmount = Number(discount) || 0;
            const taxAmount = Number(tax) || 0;
            const total = subtotal - discountAmount + taxAmount;

            // Generate order number
            const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            // Create order
            const order = await Order.create({
                businessId: business_id,
                outletId: outlet_id,
                customerId,
                tableId,
                orderNumber,
                type: type || 'DINE_IN',
                status: 'PENDING',
                billingSubtotal: subtotal,
                billingDiscount: discountAmount,
                billingTax: taxAmount,
                billingTotal: total,
                notes,
                staffId: req.user?.id
            }, { transaction });

            // Create order items
            await OrderItem.bulkCreate(
                orderItemsRaw.map(item => ({ ...item, orderId: order.id })),
                { transaction }
            );

            // Update table status if table assigned
            if (tableId) {
                await Table.update(
                    { status: 'OCCUPIED' },
                    { where: { id: tableId, businessId: business_id }, transaction }
                );
            }

            return await Order.findByPk(order.id, {
                include: [
                    { model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] },
                    { model: Table, as: 'table' }
                ],
                transaction
            });
        });

        const responseData = result.data || result;
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

            if (status) {
                order.status = status;
                if ((status === 'COMPLETED' || status === 'CANCELLED') && order.tableId) {
                    await Table.update(
                        { status: 'AVAILABLE' },
                        { where: { id: order.tableId, businessId: business_id }, transaction }
                    );
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

            return await Order.findByPk(id, {
                include: [
                    { model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] },
                    { model: Table, as: 'table' }
                ],
                transaction
            });
        });

        const responseData = result.data || result;
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
