/**
 * ORDER CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");
const { Op } = require("sequelize");
const { enforceOutletScope, buildStrictWhereClause } = require("../utils/outletGuard");

/**
 * Get all orders
 */
exports.getOrders = async (req, res, next) => {
    try {
        console.log("STEP 1 - Controller Start - getOrders");
        enforceOutletScope(req);
        const { businessId } = req;
        const { status, startDate, endDate, limit = 50, offset = 0 } = req.query;
        console.log("STEP 2 - Calling Executor (readWithTenant)");

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

        console.log("STEP 6 - Controller Received:", result);
        console.log("STEP 6.1 - Data:", result?.data);
        console.log("STEP 7 - Sending Response:", result?.data);
        
        const responseData = result.data ?? result;
        console.log("DB DATA (Phase 3 - getOrders):", responseData?.count);
        
        res.json({ 
            success: true, 
            data: responseData?.rows ?? [], 
            pagination: {
                total: responseData?.count ?? 0,
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

        console.log('[ORDER CONTROLLER] getOrderById result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        console.log("STEP 6 - Controller Received:", result);
        console.log("STEP 6.1 - Data:", result?.data);
        console.log("STEP 7 - Sending Response:", result?.data);
        
        if (!result.data) throw createHttpError(404, "Order not found");
        res.json({ success: true, data: result.data });
    } catch (error) {
        next(error);
    }
};

/**
 * Add new order
 */
exports.addOrder = async (req, res, next) => {
    try {
        console.log("STEP 1 - Controller Start - addOrder");
        enforceOutletScope(req);
        const { businessId, outletId } = req;
        const { customerId, tableId, items, type, notes, discount, tax } = req.body;
        console.log("STEP 2 - Calling Executor (executeWithTenant)");

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
                const product = await Product.findOne({
                    where: { id: item.productId, businessId },
                    transaction
                });
                
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
                billingSubtotal: subtotal,
                billingDiscount: discountAmount,
                billingTax: taxAmount,
                billingTotal: total,
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
                await Table.update(
                    { status: 'OCCUPIED' },
                    { where: { id: tableId, businessId }, transaction }
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

        console.log('[ORDER CONTROLLER] addOrder result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        console.log("STEP 6 - Controller Received:", result);
        console.log("STEP 6.1 - Data:", result?.data);
        console.log("STEP 7 - Sending Response:", result?.data);
        
        res.status(201).json({ success: true, data: result.data, message: "Order created" });
    } catch (error) {
        next(error);
    }
};

/**
 * Update order
 */
exports.updateOrder = async (req, res, next) => {
    try {
        console.log("STEP 1 - Controller Start - updateOrder");
        enforceOutletScope(req);
        const { id } = req.params;
        const { businessId } = req;
        const { status, items, discount, tax, notes } = req.body;
        console.log("STEP 2 - Calling Executor (executeWithTenant)");

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
                        { where: { id: order.tableId, businessId }, transaction }
                    );
                }
            }

            if (items && Array.isArray(items)) {
                await OrderItem.destroy({ where: { orderId: id }, transaction });

                let subtotal = 0;
                for (const item of items) {
                    const product = await Product.findOne({
                        where: { id: item.productId, businessId },
                        transaction
                    });
                    
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

        console.log('[ORDER CONTROLLER] updateOrder result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        console.log("STEP 6 - Controller Received:", result);
        console.log("STEP 6.1 - Data:", result?.data);
        console.log("STEP 7 - Sending Response:", result?.data);
        
        res.json({ success: true, data: result.data, message: "Order updated" });
    } catch (error) {
        next(error);
    }
};

/**
 * Get archived orders
 */
exports.getArchivedOrders = async (req, res, next) => {
    try {
        console.log("STEP 1 - Controller Start - getArchivedOrders");
        enforceOutletScope(req);
        const { businessId } = req;
        const { startDate, endDate, limit = 50, offset = 0 } = req.query;
        console.log("STEP 2 - Calling Executor (readWithTenant)");

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

        console.log("STEP 6 - Controller Received:", result);
        console.log("STEP 6.1 - Data:", result?.data);
        console.log("STEP 7 - Sending Response:", result?.data);
        
        const responseData = result.data;
        if (!responseData || !responseData.rows) {
            throw createHttpError(500, "Critical archived orders data missing");
        }
        
        res.json({ 
            success: true, 
            data: responseData.rows, 
            pagination: {
                total: responseData.count,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
    } catch (error) {
        next(error);
    }
};
