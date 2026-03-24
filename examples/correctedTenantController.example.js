/**
 * CORRECTED Tenant Controller Example
 * Database-per-tenant architecture - NO business_id filtering needed
 */

const createHttpError = require("http-errors");

// ✅ CORRECT: Use tenant models from request context
const getCorrectedOrderController = () => {
    const getOrders = async (req, res, next) => {
        try {
            // ✅ CORRECT: Get models from request context
            const { Order } = req.tenantModels;
            
            const { status, paymentMethod, startDate, endDate, limit } = req.query;
            const { outletId } = req.query;
            
            // ✅ CORRECT: No businessId filtering needed - database-per-tenant architecture
            // Each tenant database is already isolated
            const whereClause = {};
            
            // Only filter by outletId if provided (for role-based access within tenant)
            if (outletId) whereClause.outletId = outletId;
            
            // Apply other filters
            if (status) whereClause.orderStatus = status;
            if (paymentMethod) whereClause.payment_method = paymentMethod;
            
            // Date range filtering
            if (startDate || endDate) {
                whereClause.createdAt = {};
                if (startDate) whereClause.createdAt[Op.gte] = new Date(startDate);
                if (endDate) whereClause.createdAt[Op.lte] = new Date(endDate);
            }
            
            // ✅ CORRECT: Simple query without businessId
            const orders = await Order.findAll({
                where: whereClause,
                order: [['createdAt', 'DESC']],
                limit: limit ? parseInt(limit) : undefined
            });
            
            res.json({
                success: true,
                data: orders,
                count: orders.length
            });
            
        } catch (error) {
            console.error('Order controller error:', error);
            next(createHttpError(500, "Failed to fetch orders"));
        }
    };

    const createOrder = async (req, res, next) => {
        try {
            // ✅ CORRECT: Get models from request context
            const { Order, sequelize } = req.tenantModels;
            
            const { customerDetails, items, billing, tableId } = req.body;
            
            // ✅ CORRECT: Create order without businessId
            const order = await Order.create({
                customerDetails,
                items,
                billing,
                tableId,
                orderNumber: generateOrderNumber(),
                status: 'pending',
                totalAmount: calculateTotal(items),
                // No businessId needed - database-per-tenant architecture
            });
            
            res.status(201).json({
                success: true,
                data: order
            });
            
        } catch (error) {
            console.error('Order creation error:', error);
            next(createHttpError(500, "Failed to create order"));
        }
    };

    const updateOrder = async (req, res, next) => {
        try {
            // ✅ CORRECT: Get models from request context
            const { Order } = req.tenantModels;
            
            const { id } = req.params;
            const { status, paymentMethod } = req.body;
            
            // ✅ CORRECT: Find by primary key only (no businessId check needed)
            const order = await Order.findByPk(id);
            
            if (!order) {
                return next(createHttpError(404, "Order not found"));
            }
            
            // ✅ CORRECT: Update without businessId validation
            await order.update({
                status,
                payment_method: paymentMethod
            });
            
            res.json({
                success: true,
                data: order
            });
            
        } catch (error) {
            console.error('Order update error:', error);
            next(createHttpError(500, "Failed to update order"));
        }
    };

    return {
        getOrders,
        createOrder,
        updateOrder
    };
};

// Helper functions
function generateOrderNumber() {
    return 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
}

function calculateTotal(items) {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
}

module.exports = getCorrectedOrderController();
