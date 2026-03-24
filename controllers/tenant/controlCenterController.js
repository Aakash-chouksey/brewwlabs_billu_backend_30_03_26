/**
 * Control Center Controller - Neon-Safe Version
 * Standardized for transaction-scoped model access
 */

const { Op } = require('sequelize');

const controlCenterController = {
    /**
     * Get control center stats
     */
    getStats: async (req, res, next) => {
        try {
            const result = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { Order, Inventory, User } = models;
                const businessId = req.businessId;

                // Get date ranges
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

                const [
                    todayOrders,
                    monthOrders,
                    pendingOrders,
                    lowStockCount,
                    activeStaff
                ] = await Promise.all([
                    Order.count({
                        where: {
                            businessId,
                            createdAt: { [Op.gte]: today }
                        }
                    }),
                    Order.count({
                        where: {
                            businessId,
                            createdAt: { [Op.gte]: thisMonth }
                        }
                    }),
                    Order.count({
                        where: {
                            businessId,
                            status: { [Op.in]: ['PENDING', 'PREPARING', 'READY'] }
                        }
                    }),
                    Inventory.count({
                        where: {
                            businessId,
                            quantity: { [Op.lte]: 10 } // Simplified for performance, should use reorderLevel if possible
                        }
                    }),
                    User.count({
                        where: { businessId, isActive: true }
                    })
                ]);

                return {
                    todayOrders,
                    monthOrders,
                    pendingOrders,
                    lowStockCount,
                    activeStaff
                };
            });

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Get system health - NEON-SAFE
     */
    getSystemHealth: async (req, res, next) => {
        try {
            const result = await req.readWithTenant(async (context) => {
                const { sequelize } = context.transactionModels;
                await sequelize.query('SELECT 1', { 
                    type: sequelize.QueryTypes.SELECT 
                });
                return { status: 'healthy', database: 'connected' };
            });

            res.json({
                success: true,
                health: {
                    ...result,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            next(error);
        }
    }
};

module.exports = controlCenterController;
