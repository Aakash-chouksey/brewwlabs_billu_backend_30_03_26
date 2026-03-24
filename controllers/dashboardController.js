const { enforceOutletScope, buildStrictWhereClause } = require("../utils/outletGuard");
/**
 * DASHBOARD CONTROLLER - Neon-Safe Transaction Pattern
 */

const { Op } = require("sequelize");
const { safeQuery } = require("../utils/safeQuery");

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
            const todaySales = await safeQuery(
                () => Order.sum('billing_total', {
                    where: {
                        ...whereClause,
                        status: 'COMPLETED',
                        createdAt: { [Op.between]: [today, tomorrow] }
                    }
                }),
                0
            );

            // Orders today
            const todayOrders = await safeQuery(
                () => Order.count({
                    where: {
                        ...whereClause,
                        createdAt: { [Op.between]: [today, tomorrow] }
                    }
                }),
                0
            );

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
                safeQuery(() => Product.count({ where: productWhere }), 0),
                safeQuery(() => Product.count({ where: { ...productWhere, is_active: true } }), 0),
                safeQuery(() => Customer.count({ where: customerWhere }), 0),
                safeQuery(() => Order.count({ where: { ...whereClause, status: 'PENDING' } }), 0),
                safeQuery(() => Table.count({ where: outletId ? { outletId } : { businessId } }), 0),
                safeQuery(() => Table.count({ 
                    where: outletId ? { outletId, status: 'OCCUPIED' } : { businessId, status: 'OCCUPIED' } 
                }), 0),
                safeQuery(() => Order.count({
                    where: {
                        ...whereClause,
                        status: { [Op.in]: ['PENDING', 'IN_PROGRESS', 'READY', 'SERVED'] }
                    }
                }), 0)
            ]);

            // Recent orders (last 5) - separate as it returns objects not counts
            const recentOrders = await safeQuery(
                () => Order.findAll({
                    where: whereClause,
                    order: [['createdAt', 'DESC']],
                    limit: 5
                }),
                []
            );

            // Top selling products (last 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const topProducts = await safeQuery(
                () => OrderItem.findAll({
                    where: {
                        createdAt: { [Op.gte]: sevenDaysAgo }
                    },
                    include: [{
                        model: Product,
                        as: 'product',
                        where: productWhere,
                        attributes: ['id', 'name']
                    }],
                    attributes: [
                        'productId',
                        [sequelize.fn('SUM', sequelize.col('quantity')), 'totalSold']
                    ],
                    group: ['productId', 'Product.id', 'Product.name'],
                    order: [[sequelize.fn('SUM', sequelize.col('quantity')), 'DESC']],
                    limit: 5
                }),
                []
            );

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

        console.log("STEP 6 - Controller Received:", result);
        console.log("STEP 6.1 - Data:", result?.data);
        console.log("STEP 7 - Sending Response:", result?.data);
        
        return res.json({ 
            success: true, 
            data: result.data ?? {} // Phase 7 Fix
        });
    } catch (error) {
        next(error);
    }
};
