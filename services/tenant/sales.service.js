/**
 * Sales Service - Neon-Safe Version
 * Aligned with the new middleware-driven transaction pattern
 */

const { Op } = require('sequelize');

/**
 * Get dashboard metrics
 */
const getDashboardMetrics = async (req) => {
    const { businessId } = req;
    
    return await req.readWithTenant(async (context) => {
        const { transactionModels: models } = context;
        const { Order } = models;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Get today's orders
        const todayOrders = await Order.findAll({
            where: {
                businessId,
                createdAt: {
                    [Op.gte]: today,
                    [Op.lt]: tomorrow
                }
            }
        });
        
        const totalSales = todayOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
        const orderCount = todayOrders.length;
        
        return {
            totalSales: totalSales,
            totalRevenue: totalSales, // Alias for Metrics.jsx
            todaySales: totalSales,
            orderCount: orderCount,
            totalOrders: orderCount,
            todayOrders: orderCount,
            averageOrderValue: orderCount > 0 ? totalSales / orderCount : 0
        };
    });
};

/**
 * Get daily sales data
 */
const getDailySales = async (req) => {
    const { businessId } = req;
    const { date } = req.query;
    
    return await req.readWithTenant(async (context) => {
        const { transactionModels: models } = context;
        const { Order } = models;

        const targetDate = date ? new Date(date) : new Date();
        targetDate.setHours(0, 0, 0, 0);
        const nextDate = new Date(targetDate);
        nextDate.setDate(nextDate.getDate() + 1);
        
        const orders = await Order.findAll({
            where: {
                businessId,
                createdAt: {
                    [Op.gte]: targetDate,
                    [Op.lt]: nextDate
                }
            },
            order: [['createdAt', 'ASC']]
        });
        
        const totalSales = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
        const orderCount = orders.length;

        return {
            date: targetDate.toISOString().split('T')[0],
            totalSales: totalSales,
            totalRevenue: totalSales, // Alias
            orderCount: orderCount,
            totalOrders: orderCount, // Alias
            averageOrderValue: orderCount > 0 ? totalSales / orderCount : 0,
            orders: orders.map(o => ({
                id: o.id,
                total: o.total,
                status: o.status,
                createdAt: o.createdAt
            }))
        };
    });
};

/**
 * Get sales dashboard data
 */
const getSalesDashboard = async (req) => {
    // Combine metrics for dashboard
    // Note: getDashboardMetrics now handles its own readWithTenant scope
    const metrics = await getDashboardMetrics(req);
    
    return {
        ...metrics,
        trends: [],
        topProducts: [],
        recentOrders: []
    };
};

// Placeholder for future implementations
const getCategorySales = async (req) => ({ categories: [], message: 'Not yet implemented' });
const getItemSales = async (req) => ({ items: [], message: 'Not yet implemented' });
const getPaymentSales = async (req) => ({ payments: [], message: 'Not yet implemented' });

module.exports = {
    getDashboardMetrics,
    getDailySales,
    getCategorySales,
    getItemSales,
    getPaymentSales,
    getSalesDashboard
};
