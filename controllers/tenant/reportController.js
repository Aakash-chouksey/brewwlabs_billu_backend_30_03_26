const { enforceOutletScope, buildStrictWhereClause } = require("../../utils/outletGuard");
const { Op } = require("sequelize");

/**
 * REPORT CONTROLLER - Neon-Safe Transaction Pattern
 */

/**
 * Get daily sales report
 */
exports.getDailySales = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const business_id = req.business_id || req.businessId;
        const { date } = req.query;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Order, OrderItem, Product } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { status: 'COMPLETED' });

            const targetDate = date ? new Date(date) : new Date();
            targetDate.setHours(0, 0, 0, 0);
            const nextDate = new Date(targetDate);
            nextDate.setDate(nextDate.getDate() + 1);

            whereClause.createdAt = { [Op.between]: [targetDate, nextDate] };

            const orders = await Order.findAll({
                where: whereClause,
                include: [{ 
                    model: OrderItem, 
                    as: 'items', 
                    include: [{ model: Product, as: 'product' }] 
                }]
            });

            const totalSales = orders.reduce((sum, o) => sum + Number(o.billingTotal || 0), 0);
            const totalOrders = orders.length;
            const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

            const hourlySales = {};
            orders.forEach(order => {
                const hour = new Date(order.createdAt).getHours();
                if (!hourlySales[hour]) hourlySales[hour] = { count: 0, sales: 0 };
                hourlySales[hour].count++;
                hourlySales[hour].sales += Number(order.billingTotal || 0);
            });

            return {
                date: targetDate.toISOString().split('T')[0],
                totalSales: Math.round(totalSales * 100) / 100,
                totalOrders,
                avgOrderValue: Math.round(avgOrderValue * 100) / 100,
                hourlySales
            };
        });

        const data = result.data || result;
        
        return res.json({ 
            success: true, 
            data: data,
            message: "Daily sales report retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get item-wise sales report
 */
exports.getItemWiseSales = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const business_id = req.business_id || req.businessId;
        const { startDate, endDate } = req.query;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { OrderItem, Order, Product } = models;
            
            const { outletId: outlet_id } = buildStrictWhereClause(req);
            const orderWhereClause = { status: 'COMPLETED' };
            
            if (outlet_id) {
                orderWhereClause.outletId = outlet_id;
            }

            const dateRange = {};
            if (startDate && endDate) {
                dateRange.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
            }

            const items = await OrderItem.findAll({
                where: dateRange,
                include: [
                    {
                        model: Order,
                        as: 'order',
                        where: orderWhereClause,
                        attributes: ['id', 'status', 'createdAt']
                    },
                    {
                        model: Product,
                        as: 'product',
                        where: { businessId: business_id },
                        attributes: ['id', 'name', 'categoryId']
                    }
                ]
            });

            const productSales = {};
            items.forEach(item => {
                const product = item.product;
                if (!product) return;
                
                const pid = item.productId;
                if (!productSales[pid]) {
                    productSales[pid] = {
                        productId: pid,
                        name: product.name,
                        totalQuantity: 0,
                        totalRevenue: 0,
                        orders: 0
                    };
                }
                productSales[pid].totalQuantity += Number(item.quantity || 0);
                productSales[pid].totalRevenue += Number(item.total || 0);
                productSales[pid].orders++;
            });

            return Object.values(productSales).sort((a, b) => b.totalRevenue - a.totalRevenue);
        });

        const data = result.data || result || [];
        
        return res.json({ 
            success: true, 
            data: data,
            message: "Item-wise sales report retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get system stats (SuperAdmin only)
 */
exports.getSystemStats = async (req, res, next) => {
    try {
        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Business, User, Order } = models;
            
            const totalBusinesses = await Business.count();
            const totalUsers = await User.count();
            const todayOrders = await Order.count({
                where: {
                    createdAt: { [Op.gte]: new Date(new Date().setHours(0,0,0,0)) }
                }
            });

            return {
                totalBusinesses,
                totalUsers,
                todayOrders
            };
        });

        const data = result.data || result;
        
        return res.json({ 
            success: true, 
            data: data,
            message: "System statistics retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};
