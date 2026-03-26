const { Op } = require("sequelize");
const { enforceOutletScope, buildStrictWhereClause } = require("../utils/outletGuard");

/**
 * Get dashboard statistics
 */
exports.getDashboardStats = async (req, res, next) => {
    try {
        console.log("STEP 1 - Controller Start - getDashboardStats");
        enforceOutletScope(req);
        const { businessId } = req;
        console.log("STEP 2 - Calling Executor (executeRead)");

        const result = await req.executeRead(async ({ models, sequelize }) => {
            const { Order, Product, Customer, OrderItem, Table } = models;
            
            // Build strict where clause with MANDATORY outlet filtering
            const { whereClause, outletId } = buildStrictWhereClause(req);

            // Today's date range
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // Phase 2: Safe DB Operations using safeQuery
            // Sales today
            const todaySales = await Order.sum('billing_total', {
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

            // Build product and customer where clauses
            const productWhere = { businessId };
            const customerWhere = { businessId };
            if (outletId) {
                productWhere.outletId = outletId;
                customerWhere.outletId = outletId;
            }

            // Phase 5: Parallel independent queries for better performance
            const [
                totalProducts,
                activeProducts,
                totalCustomers,
                pendingOrders,
                totalTables,
                occupiedTables,
                activeOrders
            ] = await Promise.all([
                Product.count({ where: productWhere }),
                Product.count({ where: { ...productWhere, is_active: true } }),
                Customer.count({ where: customerWhere }),
                Order.count({ where: { ...whereClause, status: 'PENDING' } }),
                Table.count({ where: outletId ? { outletId } : { businessId } }),
                Table.count({ 
                    where: outletId ? { outletId, status: 'OCCUPIED' } : { businessId, status: 'OCCUPIED' } 
                }),
                Order.count({
                    where: {
                        ...whereClause,
                        status: { [Op.in]: ['PENDING', 'IN_PROGRESS', 'READY', 'SERVED'] }
                    }
                })
            ]);

            // Recent orders (last 5) - separate as it returns objects not counts
            const recentOrders = await Order.findAll({
                where: whereClause,
                order: [['created_at', 'DESC']],
                limit: 5
            });

            // Top selling products (last 7 days) - Use Order's createdAt since OrderItem may not have timestamps
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const topProducts = await OrderItem.findAll({
                include: [{
                    model: Order,
                    as: 'order',
                    where: {
                        createdAt: { [Op.gte]: sevenDaysAgo }
                    },
                    attributes: []
                }, {
                    model: Product,
                    as: 'product',
                    where: productWhere,
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

            console.log("DB DATA (Phase 3 - Dashboard):", bestSeller); // Phase 3 log
            return {
                // Phase 3 & 4: Safe Response Structure
                revenue: Number(todaySales) || 0,
                activeOrders: activeOrders || 0,
                occupiedTables: `${occupiedTables || 0} / ${totalTables || 0}`,
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
        });

        const data = result.data;

        // Handle empty dashboard data gracefully (STEP 6)
        if (!data || Object.keys(data).length === 0) {
            console.log("ℹ️ Dashboard data is empty");
            return res.json({ 
                success: true, 
                data: {
                    revenue: 0,
                    activeOrders: 0,
                    occupiedTables: "0 / 0",
                    bestSeller: 'N/A',
                    sales: { today: 0, ordersToday: 0 },
                    products: { total: 0, active: 0 },
                    customers: { total: 0 },
                    orders: { pending: 0, active: 0 },
                    recentOrders: [],
                    topProducts: []
                }
            });
        }

        return res.json({ 
            success: true, 
            data: data
        });
    } catch (error) {
        next(error);
    }
};
