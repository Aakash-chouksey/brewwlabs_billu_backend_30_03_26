/**
 * CONTROL CENTER CONTROLLER - Neon-Safe Version
 * Standardized for transaction-scoped model access
 */

const { Op } = require('sequelize');

const controlCenterController = {
    /**
     * Get control center stats
     */
    getStats: async (req, res, next) => {
        try {
            const business_id = req.business_id || req.businessId;
            const outlet_id = req.outlet_id || req.outletId;

            const result = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { Order, Inventory, User } = models;

                // Get date ranges
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

                const baseWhere = { businessId: business_id };
                if (outlet_id) baseWhere.outletId = outlet_id;

                const [
                    todayOrders,
                    monthOrders,
                    pendingOrders,
                    lowStockCount,
                    activeStaff
                ] = await Promise.all([
                    Order.count({
                        where: {
                            ...baseWhere,
                            createdAt: { [Op.gte]: today }
                        }
                    }),
                    Order.count({
                        where: {
                            ...baseWhere,
                            createdAt: { [Op.gte]: thisMonth }
                        }
                    }),
                    Order.count({
                        where: {
                            ...baseWhere,
                            status: { [Op.in]: ['PENDING', 'PREPARING', 'READY'] }
                        }
                    }),
                    Inventory.count({
                        where: {
                            ...baseWhere,
                            quantity: { [Op.lte]: 10 }
                        }
                    }),
                    User.count({
                        where: { businessId: business_id, isActive: true } // Staff/Users are business-wide
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

            const data = result.data || result;

            res.json({
                success: true,
                data: data,
                message: "Control center statistics retrieved successfully"
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
                // Simple health check query
                await sequelize.query('SELECT 1', { 
                    type: sequelize.QueryTypes.SELECT 
                });
                return { 
                    status: 'healthy', 
                    database: 'connected',
                    schema: req.tenantSchema || 'public'
                };
            });

            const data = result.data || result;

            res.json({
                success: true,
                data: {
                    ...data,
                    timestamp: new Date().toISOString()
                },
                message: "System health check passed"
            });

        } catch (error) {
            next(error);
        }
    }
};

module.exports = controlCenterController;
