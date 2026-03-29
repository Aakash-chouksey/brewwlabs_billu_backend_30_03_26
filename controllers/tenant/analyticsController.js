/**
 * ANALYTICS CONTROLLER - Neon-Safe Transaction Pattern
 */

const { enforceOutletScope, buildStrictWhereClause } = require("../../utils/outletGuard");
const { Op } = require("sequelize");

/**
 * Get sales trends
 */
exports.getSalesTrends = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const business_id = req.business_id || req.businessId;
        const { days = 30 } = req.query;

        const cacheKey = `sales_trends_${days}_${req.outlet_id || 'all'}`;
        const result = await req.readWithCache(business_id, cacheKey, async (context) => {
            const { transactionModels: models } = context;
            const { Order } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { status: 'COMPLETED' });

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));
            whereClause.createdAt = { [Op.gte]: startDate };

            const orders = await Order.findAll({ 
                where: whereClause, 
                attributes: ['createdAt', 'billingTotal'] 
            });

            // Group by date
            const dailyData = {};
            (orders || []).forEach(order => {
                const date = order?.createdAt?.toISOString().split('T')[0];
                if (!date) return;
                
                if (!dailyData[date]) {
                    dailyData[date] = { date, sales: 0, orders: 0 };
                }
                dailyData[date].sales += Number(order?.billingTotal) || 0;
                dailyData[date].orders++;
            });

            return Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
        }, { ttl: 300000 }); // 5 minute cache

        const data = result.data || result || [];
        res.json({ 
            success: true, 
            data: data,
            message: "Sales trends retrieved successfully"
        });
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
        const business_id = req.business_id || req.businessId;
        const { limit = 10 } = req.query;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { OrderItem, Order, Product } = models;
            
            const { outletId: outlet_id } = buildStrictWhereClause(req);
            const orderWhereClause = { status: 'COMPLETED' };
            
            if (outlet_id) {
                orderWhereClause.outletId = outlet_id;
            }

            const items = await OrderItem.findAll({
                include: [
                    {
                        model: Order,
                        as: 'order',
                        where: orderWhereClause,
                        attributes: ['id']
                    },
                    {
                        model: Product,
                        as: 'product',
                        where: { businessId: business_id },
                        attributes: ['id', 'name', 'categoryId']
                    }
                ]
            });

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
                productMap[pid].revenue += Number(item.total) || 0;
            });

            return Object.values(productMap)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, parseInt(limit));
        });

        const data = result.data || result || [];
        res.json({ 
            success: true, 
            data: data,
            message: "Top products retrieved successfully"
        });
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
        const business_id = req.business_id || req.businessId;
        const { days = 30 } = req.query;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Order } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { status: 'COMPLETED' });

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));
            whereClause.createdAt = { [Op.gte]: startDate };

            const orders = await Order.findAll({ 
                where: whereClause, 
                attributes: ['createdAt', 'billingTotal'] 
            });

            // Group by hour
            const hourlyData = {};
            for (let i = 0; i < 24; i++) {
                hourlyData[i] = { hour: i, sales: 0, orders: 0 };
            }

            (orders || []).forEach(order => {
                if (!order?.createdAt) return;
                const hour = new Date(order.createdAt).getHours();
                hourlyData[hour].sales += Number(order.billingTotal) || 0;
                hourlyData[hour].orders++;
            });

            return Object.values(hourlyData);
        });

        const data = result.data || result || [];
        res.json({ 
            success: true, 
            data: data,
            message: "Peak hours data retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get analytics summary
 */
exports.getSummary = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const business_id = req.business_id || req.businessId;

        const cacheKey = `analytics_summary_${req.outlet_id || 'all'}`;
        const result = await req.readWithCache(business_id, cacheKey, async (context) => {
            const { transactionModels: models } = context;
            const { Order, Customer, Product } = models;
            
            const { outletId: outlet_id } = buildStrictWhereClause(req);
            
            // Get today's stats
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const todayWhere = { 
                businessId: business_id, 
                status: 'COMPLETED', 
                createdAt: { [Op.between]: [today, tomorrow] } 
            };
            const monthWhere = { 
                businessId: business_id, 
                status: 'COMPLETED',
                createdAt: { [Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } 
            };
            
            if (outlet_id) {
                todayWhere.outletId = outlet_id;
                monthWhere.outletId = outlet_id;
            }

            const [todaySales, todayOrders, monthSales, monthOrders] = await Promise.all([
                Order.sum('billingTotal', { where: todayWhere }) || 0,
                Order.count({ where: todayWhere }),
                Order.sum('billingTotal', { where: monthWhere }) || 0,
                Order.count({ where: monthWhere })
            ]);

            const [totalCustomers, totalProducts] = await Promise.all([
                Customer.count({ where: { businessId: business_id, ...(outlet_id && { outletId: outlet_id }) } }),
                Product.count({ where: { businessId: business_id, ...(outlet_id && { outletId: outlet_id }) } })
            ]);

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
        }, { ttl: 60000 }); // 1 minute cache

        const data = result.data || result;
        res.json({ 
            success: true, 
            data: data,
            message: "Analytics summary retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get average ticket per staff
 */
exports.getAvgTicketsPerAgent = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const business_id = req.business_id || req.businessId;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Order, User } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { status: 'COMPLETED' });

            const orders = await Order.findAll({
                where: whereClause,
                attributes: ['id', 'billingTotal', 'staffId'],
                include: [{ model: User, as: 'staff', attributes: ['id', 'name'] }]
            });

            // Group by staff
            const staffMap = {};
            orders.forEach(order => {
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
                staffMap[staffId].totalSales += Number(order?.billingTotal) || 0;
            });

            return Object.values(staffMap).map(s => ({
                ...s,
                avgTicket: s.totalOrders > 0 ? Math.round((s.totalSales / s.totalOrders) * 100) / 100 : 0
            }));
        });

        const data = result.data || result || [];
        res.json({ 
            success: true, 
            data: data,
            message: "Staff performance analytics retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};
