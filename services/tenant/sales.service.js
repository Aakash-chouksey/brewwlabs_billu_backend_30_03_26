/**
 * Sales Service - Neon-Safe Version
 * Standardized for transaction-scoped model access and consistent API contracts
 */

const { Op } = require('sequelize');

/**
 * Get dashboard metrics
 */
const getDashboardMetrics = async (req) => {
    const { businessId, outletId } = req;
    
    return await req.readWithTenant(async (context) => {
        const { transactionModels: models } = context;
        const { Order } = models;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const whereClause = { businessId };
        if (outletId) whereClause.outletId = outletId;
        whereClause.createdAt = { [Op.gte]: today };
        whereClause.status = { [Op.notIn]: ['CANCELLED', 'VOID'] };

        const todayOrders = await Order.findAll({ where: whereClause });
        
        const totalSales = todayOrders.reduce((sum, order) => sum + (Number(order.billingTotal) || 0), 0);
        const orderCount = todayOrders.length;
        
        return {
            totalRevenue: totalSales,
            todaySales: totalSales,
            totalSales: totalSales,
            orderCount: orderCount,
            totalOrders: orderCount,
            averageOrderValue: orderCount > 0 ? (totalSales / orderCount).toFixed(2) : 0
        };
    });
};

/**
 * Get daily sales data
 */
const getDailySales = async (req) => {
    const { businessId, outletId } = req;
    const { date } = req.query;
    
    return await req.readWithTenant(async (context) => {
        const { transactionModels: models } = context;
        const { Order } = models;

        const targetDate = date ? new Date(date) : new Date();
        targetDate.setHours(0, 0, 0, 0);
        const nextDate = new Date(targetDate);
        nextDate.setDate(nextDate.getDate() + 1);
        
        const whereClause = { businessId };
        if (outletId) whereClause.outletId = outletId;
        whereClause.createdAt = { [Op.gte]: targetDate, [Op.lt]: nextDate };
        whereClause.status = { [Op.notIn]: ['CANCELLED', 'VOID'] };

        const orders = await Order.findAll({
            where: whereClause,
            order: [['createdAt', 'DESC']]
        });
        
        const totalSales = orders.reduce((sum, order) => sum + (Number(order.billingTotal) || 0), 0);
        const orderCount = orders.length;
        const uniqueCustomers = new Set(orders.map(o => o.customerDetails?.phone || o.id)).size;

        return {
            totalSales: totalSales,
            totalOrders: orderCount,
            totalCustomers: uniqueCustomers,
            avgOrderValue: orderCount > 0 ? (totalSales / orderCount).toFixed(2) : 0,
            recentOrders: orders.slice(0, 10).map(o => ({
                id: o.id,
                orderNumber: o.orderNumber,
                totalAmount: o.billingTotal,
                paymentMethod: o.paymentMethod || 'UNKNOWN',
                status: o.status,
                createdAt: o.createdAt
            }))
        };
    });
};

/**
 * Get item sales report
 */
const getItemSales = async (req) => {
    const { businessId, outletId } = req;
    const { period = 'today' } = req.query;
    
    return await req.readWithTenant(async (context) => {
        const { transactionModels: models } = context;
        const { Order, OrderItem, Product, Category } = models;

        const startDate = calculateStartDate(period);

        const orders = await Order.findAll({
            where: {
                businessId,
                ...(outletId && { outletId }),
                createdAt: { [Op.gte]: startDate },
                status: { [Op.notIn]: ['CANCELLED', 'VOID'] }
            },
            include: [{
                model: OrderItem,
                as: 'items',
                include: [{
                    model: Product,
                    as: 'product',
                    include: [{ model: Category, as: 'category' }]
                }]
            }]
        });

        const itemMap = new Map();
        let totalRevenue = 0;
        let totalQuantitySold = 0;

        orders.forEach(order => {
            (order.items || []).forEach(item => {
                const productId = item.productId || item.product?.id;
                if (!productId) return;

                const subtotal = Number(item.subtotal) || 0;
                const quantity = Number(item.quantity) || 0;
                
                totalRevenue += subtotal;
                totalQuantitySold += quantity;

                if (!itemMap.has(productId)) {
                    itemMap.set(productId, {
                        id: productId,
                        name: item.name || item.product?.name || 'Unknown Item',
                        category: item.product?.category?.name || 'Uncategorized',
                        quantitySold: 0,
                        totalRevenue: 0,
                        trend: 'neutral',
                        trendPercentage: 0
                    });
                }

                const stats = itemMap.get(productId);
                stats.quantitySold += quantity;
                stats.totalRevenue += subtotal;
            });
        });

        const items = Array.from(itemMap.values()).map(item => ({
            ...item,
            averagePrice: item.quantitySold > 0 ? (item.totalRevenue / item.quantitySold).toFixed(2) : 0
        }));

        return {
            data: items,
            summary: {
                totalRevenue,
                totalQuantitySold,
                uniqueItemCount: items.length,
                period
            }
        };
    });
};

/**
 * Get category sales report
 */
const getCategorySales = async (req) => {
    const { businessId, outletId } = req;
    const { period = 'today' } = req.query;
    
    return await req.readWithTenant(async (context) => {
        const { transactionModels: models } = context;
        const { Order, OrderItem, Product, Category } = models;

        const startDate = calculateStartDate(period);

        const orders = await Order.findAll({
            where: {
                businessId,
                ...(outletId && { outletId }),
                createdAt: { [Op.gte]: startDate },
                status: { [Op.notIn]: ['CANCELLED', 'VOID'] }
            },
            include: [{
                model: OrderItem,
                as: 'items',
                include: [{
                    model: Product,
                    as: 'product',
                    include: [{ model: Category, as: 'category' }]
                }]
            }]
        });

        const categoryMap = new Map();

        orders.forEach(order => {
            (order.items || []).forEach(item => {
                const category = item.product?.category;
                const categoryId = category?.id || 'uncategorized';
                const categoryName = category?.name || 'Uncategorized';

                if (!categoryMap.has(categoryId)) {
                    categoryMap.set(categoryId, {
                        id: categoryId,
                        name: categoryName,
                        itemsSold: 0,
                        totalRevenue: 0,
                        orderCount: 0,
                        itemCount: 0,
                        color: getRandomColor(categoryName),
                        trend: 'neutral',
                        trendPercentage: 0
                    });
                }

                const stats = categoryMap.get(categoryId);
                stats.itemsSold += Number(item.quantity) || 0;
                stats.totalRevenue += Number(item.subtotal) || 0;
                stats.itemCount += 1;
            });
            
            // Unique categories in this order
            const orderCategories = new Set((order.items || []).map(i => i.product?.category?.id || 'uncategorized'));
            orderCategories.forEach(cid => {
                if (categoryMap.has(cid)) categoryMap.get(cid).orderCount += 1;
            });
        });

        return {
            data: Array.from(categoryMap.values())
        };
    });
};

/**
 * Get payment methods report
 */
const getPaymentSales = async (req) => {
    const { businessId, outletId } = req;
    const { period = 'today' } = req.query;
    
    return await req.readWithTenant(async (context) => {
        const { transactionModels: models } = context;
        const { Order } = models;

        const startDate = calculateStartDate(period);

        const orders = await Order.findAll({
            where: {
                businessId,
                ...(outletId && { outletId }),
                createdAt: { [Op.gte]: startDate },
                status: { [Op.notIn]: ['CANCELLED', 'VOID'] }
            }
        });

        const paymentMap = new Map();
        let totalRevenue = 0;

        orders.forEach(order => {
            const method = order.paymentMethod || 'CASH';
            const revenue = Number(order.billingTotal) || 0;
            totalRevenue += revenue;

            if (!paymentMap.has(method)) {
                paymentMap.set(method, {
                    name: method,
                    revenue: 0,
                    transactionCount: 0,
                    successRate: 100
                });
            }

            const stats = paymentMap.get(method);
            stats.revenue += revenue;
            stats.transactionCount += 1;
        });

        return {
            data: {
                totalRevenue,
                totalTransactions: orders.length,
                paymentMethods: Array.from(paymentMap.values())
            }
        };
    });
};

/**
 * Helper to calculate start date
 */
function calculateStartDate(period) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);

    if (period === 'week') {
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        date.setDate(diff);
    } else if (period === 'month') {
        date.setDate(1);
    } else if (period === 'year') {
        date.setMonth(0, 1);
    }
    return date;
}

/**
 * Helper to get random but deterministic color for categories
 */
function getRandomColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];
    return colors[Math.abs(hash) % colors.length];
}

module.exports = {
    getDashboardMetrics,
    getDailySales,
    getCategorySales,
    getItemSales,
    getPaymentSales,
    getPaymentSummary: getPaymentSales, // Alias for controller consistency
    getSalesDashboard: getDashboardMetrics
};
