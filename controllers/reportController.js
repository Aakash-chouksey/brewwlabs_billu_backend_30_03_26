const { enforceOutletScope, buildStrictWhereClause } = require("../utils/outletGuard");
/**
 * REPORT CONTROLLER - Neon-Safe Transaction Pattern
 */

const { Op } = require("sequelize");

/**
 * Get daily sales report
 */
exports.getDailySales = async (req, res, next) => {
    enforceOutletScope(req);
    try {
        console.log("STEP 1 - Controller Start - getDailySales");
        enforceOutletScope(req);
        const { businessId } = req;
        const { date } = req.query;
        console.log("STEP 2 - Calling Executor (executeRead)");

        const result = await req.executeRead(async ({ models }) => {
            const { Order, OrderItem, Product } = models;
            
            // Build strict where clause with MANDATORY outlet filtering
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

            const totalSales = orders.reduce((sum, o) => sum + Number(o.billing_total || 0), 0);
            const totalOrders = orders.length;
            const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

            // Sales by hour
            const hourlySales = {};
            orders.forEach(order => {
                const hour = new Date(order.createdAt).getHours();
                if (!hourlySales[hour]) hourlySales[hour] = { count: 0, sales: 0 };
                hourlySales[hour].count++;
                hourlySales[hour].sales += Number(order.billing_total || 0);
            });

            const finalData = {
                date: targetDate.toISOString().split('T')[0],
                totalSales: Math.round(totalSales * 100) / 100,
                totalRevenue: Math.round(totalSales * 100) / 100,
                totalOrders,
                orderCount: totalOrders,
                avgOrderValue: Math.round(avgOrderValue * 100) / 100,
                averageOrderValue: Math.round(avgOrderValue * 100) / 100,
                hourlySales
            };
            console.log("DB DATA (Phase 3 - DailySales):", finalData);
            return finalData;
        });

        console.log("STEP 6 - Controller Received:", result);
        console.log("STEP 6.1 - Data:", result?.data);
        console.log("STEP 7 - Sending Response:", result?.data);
        
        return res.json({ 
            success: true, 
            data: result.data ?? [] // Phase 7 Fix (Analytics)
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get item-wise sales report
 */
exports.getItemWiseSales = async (req, res, next) => {
    enforceOutletScope(req);
    try {
        console.log("STEP 1 - Controller Start - getItemWiseSales");
        enforceOutletScope(req);
        const { businessId } = req;
        const { startDate, endDate } = req.query;
        console.log("STEP 2 - Calling Executor (executeRead)");

        const result = await req.executeRead(async ({ models }) => {
            const { OrderItem, Order, Product } = models;
            
            // Build strict where clause with MANDATORY outlet filtering
            const { outletId } = buildStrictWhereClause(req);
            const orderWhereClause = { status: 'COMPLETED' };
            
            // Apply outlet filter to order query if scoped
            if (outletId) {
                orderWhereClause.outletId = outletId;
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
                        where: orderWhereClause,
                        attributes: ['id', 'status', 'created_at']
                    },
                    {
                        model: Product,
                        as: 'product',
                        where: { businessId },
                        attributes: ['id', 'name', 'categoryId']
                    }
                ]
            });

            // Aggregate by product
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
                productSales[pid].totalRevenue += Number(item.subtotal || 0);
                productSales[pid].orders++;
            });

            const finalData = Object.values(productSales).sort((a, b) => b.totalRevenue - a.totalRevenue);
            console.log("DB DATA (Phase 3 - ItemWiseSales):", finalData?.length);
            return finalData;
        });

        console.log("STEP 6 - Controller Received:", result);
        console.log("STEP 6.1 - Data:", result?.data);
        console.log("STEP 7 - Sending Response:", result?.data);
        
        return res.json({ success: true, data: result.data ?? [] });
    } catch (error) {
        next(error);
    }
};

/**
 * Get system stats (SuperAdmin only)
 * NOTA BENE: This is a cross-tenant / platform operation.
 * It still uses readWithTenant for the specific requested business context,
 * but for true platform stats it would need to target 'public'.
 */
exports.getSystemStats = async (req, res, next) => {
    try {
        console.log("STEP 1 - Controller Start - getSystemStats");
        console.log("STEP 2 - Calling Executor (executeRead)");
        const result = await req.executeRead(async ({ models }) => {
            const { Business, User, AuditLog } = models;
            
            const totalBusinesses = await Business.count();
            const totalUsers = await User.count();
            const recentLogs = await AuditLog.count({
                where: {
                    createdAt: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                }
            });

            const finalData = {
                totalBusinesses,
                totalUsers,
                recentLogs
            };
            console.log("DB DATA (Phase 3 - SystemStats):", finalData);
            return finalData;
        });

        if (!result || !result.data || Object.keys(result.data).length === 0) {
            throw createHttpError(500, "Critical report data missing");
        }

        return res.json({ success: true, data: result.data });
    } catch (error) {
        next(error);
    }
};
