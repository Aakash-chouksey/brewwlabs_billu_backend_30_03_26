/**
 * ANALYTICS CONTROLLER - Neon-Safe Transaction Pattern
 */

const { enforceOutletScope, buildStrictWhereClause } = require("../utils/outletGuard");
const { Op } = require("sequelize");
const { safeQuery } = require("../utils/safeQuery");

/**
 * Get sales trends
 */
exports.getSalesTrends = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { businessId } = req;
        const { days = 30 } = req.query;

        const result = await req.executeRead(async ({ models }) => {
            const { Order } = models;
            
            // Build strict where clause with MANDATORY outlet filtering
            const { whereClause } = buildStrictWhereClause(req, { status: 'COMPLETED' });

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));
            whereClause.createdAt = { [Op.gte]: startDate };

            const orders = await safeQuery(
                () => Order.findAll({
                    where: whereClause,
                    attributes: ['createdAt', 'billing_total']
                }),
                []
            );

            // Group by date
            const dailyData = {};
            (orders || []).forEach(order => {
                const date = order?.createdAt?.toISOString().split('T')[0];
                if (!date) return;
                
                if (!dailyData[date]) {
                    dailyData[date] = { date, sales: 0, orders: 0 };
                }
                dailyData[date].sales += Number(order?.billing_total) || 0;
                dailyData[date].orders++;
            });

            return Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
        });

        console.log('[ANALYTICS CONTROLLER] getSalesTrends result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData });
    } catch (error) {
        next(error);
    }
};

/**
 * Get top products
 */
exports.getTopProducts = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { businessId } = req;
        const { limit = 10 } = req.query;

        const result = await req.executeRead(async ({ models }) => {
            const { OrderItem, Order, Product } = models;
            
            // Build strict where clause with MANDATORY outlet filtering
            const { whereClause } = buildStrictWhereClause(req);
            const orderWhereClause = { status: 'COMPLETED' };
            
            if (whereClause.outletId) {
                orderWhereClause.outletId = whereClause.outletId;
            }

            const items = await safeQuery(
                () => OrderItem.findAll({
                    include: [
                        {
                            model: Order,
                            where: orderWhereClause,
                            attributes: ['id']
                        },
                        {
                            model: Product,
                            as: 'product',
                            where: { businessId },
                            attributes: ['id', 'name', 'categoryId']
                        }
                    ]
                }),
                []
            );

            // Aggregate
            const productMap = {};
            (items || []).forEach(item => {
                if (!item?.product) return;
                const pid = item?.productId;
                if (!pid) return;

                if (!productMap[pid]) {
                    productMap[pid] = {
                        productId: pid,
                        name: item.product.name,
                        quantity: 0,
                        revenue: 0
                    };
                }
                productMap[pid].quantity += Number(item.quantity) || 0;
                productMap[pid].revenue += Number(item.subtotal) || 0;
            });

            return Object.values(productMap)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, parseInt(limit));
        });

        console.log("STEP 6 - Controller Received:", result);
        console.log("STEP 6.1 - Data:", result?.data);
        console.log("STEP 7 - Sending Response:", result?.data);
        
        return res.json({ success: true, data: result.data });
    } catch (error) {
        next(error);
    }
};

/**
 * Get peak hours
 */
exports.getPeakHours = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { businessId } = req;
        const { days = 30 } = req.query;

        const result = await req.executeRead(async ({ models }) => {
            const { Order } = models;
            
            // Build strict where clause with MANDATORY outlet filtering
            const { whereClause } = buildStrictWhereClause(req, { status: 'COMPLETED' });

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));
            whereClause.createdAt = { [Op.gte]: startDate };

            const orders = await safeQuery(
                () => Order.findAll({
                    where: whereClause,
                    attributes: ['createdAt', 'billing_total']
                }),
                []
            );

            // Group by hour
            const hourlyData = {};
            for (let i = 0; i < 24; i++) {
                hourlyData[i] = { hour: i, sales: 0, orders: 0 };
            }

            (orders || []).forEach(order => {
                if (!order?.createdAt) return;
                const hour = new Date(order.createdAt).getHours();
                hourlyData[hour].sales += Number(order.billing_total) || 0;
                hourlyData[hour].orders++;
            });

            return Object.values(hourlyData);
        });

        console.log("STEP 6 - Controller Received:", result);
        console.log("STEP 6.1 - Data:", result?.data);
        console.log("STEP 7 - Sending Response:", result?.data);
        
        return res.json({ success: true, data: result.data });
    } catch (error) {
        next(error);
    }
};

/**
 * Get analytics summary for business
 */
exports.getSummary = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { businessId } = req.params;

        const result = await req.executeRead(async ({ models }) => {
            const { Order, Customer, Product } = models;
            
            // Build strict where clause with MANDATORY outlet filtering
            const { outletId } = buildStrictWhereClause(req);
            
            // Get today's stats
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const todayWhere = { 
                businessId, 
                status: 'COMPLETED', 
                createdAt: { [Op.between]: [today, tomorrow] } 
            };
            const monthWhere = { 
                businessId, 
                status: 'COMPLETED',
                createdAt: { [Op.gte]: new Date().setDate(1) } 
            };
            
            if (outletId) {
                todayWhere.outletId = outletId;
                monthWhere.outletId = outletId;
            }

            // Phase 4: Use billing_total for sum
            const todaySales = await safeQuery(
                () => Order.sum('billing_total', { where: todayWhere }),
                0
            );
            const todayOrders = await safeQuery(
                () => Order.count({ where: todayWhere }),
                0
            );
            const monthSales = await safeQuery(
                () => Order.sum('billing_total', { where: monthWhere }),
                0
            );
            const monthOrders = await safeQuery(
                () => Order.count({ where: monthWhere }),
                0
            );

            // Build customer and product where clauses
            const customerWhere = { businessId };
            const productWhere = { businessId };
            if (outletId) {
                customerWhere.outletId = outletId;
                productWhere.outletId = outletId;
            }

            const totalCustomers = await safeQuery(() => Customer.count({ where: customerWhere }), 0);
            const totalProducts = await safeQuery(() => Product.count({ where: productWhere }), 0);

            return {
                today: {
                    sales: Math.round(Number(todaySales) * 100) / 100,
                    orders: Number(todayOrders) || 0
                },
                month: {
                    sales: Math.round(Number(monthSales) * 100) / 100,
                    orders: Number(monthOrders) || 0
                },
                totals: {
                    customers: totalCustomers || 0,
                    products: totalProducts || 0
                }
            };
        });

        console.log("STEP 6 - Controller Received:", result);
        console.log("STEP 6.1 - Data:", result?.data);
        console.log("STEP 7 - Sending Response:", result?.data);
        
        return res.json({ success: true, data: result.data });
    } catch (error) {
        next(error);
    }
};

/**
 * Get average tickets per agent
 */
exports.getAvgTicketsPerAgent = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { businessId } = req.params;

        const result = await req.executeRead(async ({ models }) => {
            const { Order, User } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { status: 'COMPLETED' });

            const orders = await safeQuery(
                () => Order.findAll({
                    where: whereClause,
                    include: [{ model: User, as: 'staff', attributes: ['id', 'name'] }]
                }),
                []
            );

            // Group by staff
            const staffMap = {};
            (orders || []).forEach(order => {
                const staffId = order?.staffId || 'unknown';
                if (!staffMap[staffId]) {
                    staffMap[staffId] = {
                        staffId,
                        name: order?.staff?.name || 'Unknown',
                        totalOrders: 0,
                        totalSales: 0
                    };
                }
                staffMap[staffId].totalOrders++;
                staffMap[staffId].totalSales += Number(order?.billing_total) || 0;
            });

            return Object.values(staffMap).map(s => ({
                ...s,
                avgTicket: s.totalOrders > 0 ? Math.round((s.totalSales / s.totalOrders) * 100) / 100 : 0
            }));
        });

        console.log("STEP 6 - Controller Received:", result);
        console.log("STEP 6.1 - Data:", result?.data);
        console.log("STEP 7 - Sending Response:", result?.data);
        
        return res.json({ success: true, data: result.data });
    } catch (error) {
        next(error);
    }
};
