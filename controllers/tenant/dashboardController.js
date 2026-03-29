const createHttpError = require("http-errors");
const { Op } = require("sequelize");
const { enforceOutletScope, buildStrictWhereClause } = require("../../utils/outletGuard"); // Keep original path for dashboardController

/**
 * Get dashboard statistics
 */
exports.getDashboardStats = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const business_id = req.business_id || req.businessId;

        const cacheKey = `dashboard_stats_${req.outlet_id || 'all'}`;
        const result = await req.readWithCache(business_id, cacheKey, async (context) => {
            const { transactionModels: models, sequelize } = context;
            const { Order, Product, Customer, OrderItem, Table } = models;
            
            const { whereClause, outletId: outlet_id } = buildStrictWhereClause(req);

            // Today's date range
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // Sales today
            const todaySales = await Order.sum('billingTotal', {
                where: {
                    ...whereClause,
                    status: 'COMPLETED',
                    createdAt: { [Op.between]: [today, tomorrow] }
                }
            }) || 0;

            // Orders today
            const todayOrders = await Order.count({
                where: {
                    ...whereClause,
                    createdAt: { [Op.between]: [today, tomorrow] }
                }
            });

            const baseWhere = { businessId: business_id };
            if (outlet_id) baseWhere.outletId = outlet_id;

            const [
                totalProducts,
                activeProducts,
                totalCustomers,
                pendingOrders,
                totalTables,
                occupiedTablesCount,
                activeOrders
            ] = await Promise.all([
                Product.count({ where: baseWhere }),
                Product.count({ where: { ...baseWhere, isActive: true } }),
                Customer.count({ where: baseWhere }),
                Order.count({ where: { ...whereClause, status: 'PENDING' } }),
                Table.count({ where: baseWhere }),
                Table.count({ where: { ...baseWhere, status: 'OCCUPIED' } }),
                Order.count({
                    where: {
                        ...whereClause,
                        status: { [Op.in]: ['PENDING', 'IN_PROGRESS', 'READY', 'SERVED'] }
                    }
                })
            ]);

            const recentOrders = await Order.findAll({
                where: whereClause,
                attributes: ['id', 'orderNumber', 'status', 'billingTotal', 'createdAt'],
                order: [['created_at', 'DESC']],
                limit: 5
            });

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const topProducts = await OrderItem.findAll({
                include: [{
                    model: Order,
                    as: 'order',
                    where: {
                        ...whereClause,
                        createdAt: { [Op.gte]: sevenDaysAgo }
                    },
                    attributes: []
                }, {
                    model: Product,
                    as: 'product',
                    where: { businessId: business_id },
                    attributes: ['id', 'name']
                }],
                attributes: [
                    'productId',
                    [sequelize.fn('SUM', sequelize.col('quantity')), 'totalSold']
                ],
                group: ['productId', 'product.id', 'product.name'],
                order: [[sequelize.fn('SUM', sequelize.col('quantity')), 'DESC']],
                limit: 5
            });

            const bestSeller = topProducts.length > 0 
                ? topProducts[0].product?.name || 'N/A' 
                : 'N/A';

            return {
                revenue: Number(todaySales) || 0,
                activeOrdersCount: activeOrders || 0,
                occupiedTablesCount: `${occupiedTablesCount || 0} / ${totalTables || 0}`,
                bestSeller: bestSeller,
                sales: {
                    today: Number(todaySales) || 0,
                    ordersToday: todayOrders || 0
                },
                products: {
                    total: totalProducts || 0,
                    active: activeProducts || 0
                },
                customers: {
                    total: totalCustomers || 0
                },
                orders: {
                    pending: pendingOrders || 0,
                    active: activeOrders || 0
                },
                recentOrders: recentOrders || [],
                topProducts: (topProducts || []).map(p => ({
                    productId: p?.productId,
                    name: p?.product?.name || 'Unknown',
                    totalSold: parseInt(p?.get('totalSold')) || 0
                }))
            };
        }, { ttl: 60000 }); // 1 minute cache

        const data = result.data || result;

        res.json({ 
            success: true, 
            data: data,
            message: "Dashboard statistics retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};
