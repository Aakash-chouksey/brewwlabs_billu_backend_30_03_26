/**
 * Live Controller - Neon-Safe Version
 * Standardized for transaction-scoped model access and fail-safe operations
 */

const { Op } = require('sequelize');

const liveController = {
    /**
     * Get live orders
     */
    getLiveOrders: async (req, res, next) => {
        try {
            const { businessId, outletId } = req;

            const orders = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { Order, OrderItem, Product, Table, Customer } = models;

                return await Order.findAll({
                    where: {
                        businessId,
                        outletId,
                        status: {
                            [Op.notIn]: ['COMPLETED', 'CANCELLED', 'ARCHIVED']
                        }
                    },
                    include: [
                        { model: OrderItem, as: 'items', include: [{ model: Product, as: 'product' }] },
                        { model: Table, as: 'table' },
                        { model: Customer, as: 'customer' }
                    ],
                    order: [['created_at', 'DESC']],
                    limit: 50
                });
            });

            res.json({
                success: true,
                data: orders || [],
                count: (orders || []).length
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Get live stats
     */
    getLiveStats: async (req, res, next) => {
        try {
            const { businessId, outletId } = req;

            const stats = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { Order, Table } = models;

                // Get today's date range
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                // Phase 5: Force Fail-Safe APIs using safeQuery
                const activeOrdersCount = await Order.count({
                    where: {
                        businessId,
                        outletId,
                        status: { [Op.notIn]: ['COMPLETED', 'CANCELLED'] }
                    }
                });

                const todayOrdersCount = await Order.count({
                    where: {
                        businessId,
                        outletId,
                        createdAt: { [Op.gte]: today, [Op.lt]: tomorrow }
                    }
                });

                const todayRevenueSum = await Order.sum('billing_total', {
                    where: {
                        businessId,
                        outletId,
                        createdAt: { [Op.gte]: today, [Op.lt]: tomorrow },
                        status: { [Op.notIn]: ['CANCELLED'] }
                    }
                }) || 0;

                const occupiedTablesCount = await Table.count({
                    where: {
                        businessId,
                        outletId,
                        status: 'OCCUPIED'
                    }
                });

                const totalTablesCount = await Table.count({
                    where: { businessId, outletId }
                });

                return {
                    activeOrders: activeOrdersCount,
                    todayOrders: todayOrdersCount,
                    todayRevenue: Number(todayRevenueSum || 0),
                    occupiedTables: occupiedTablesCount,
                    totalTables: totalTablesCount,
                    tableUtilization: totalTablesCount > 0 ? Math.round((occupiedTablesCount / totalTablesCount) * 100) : 0
                };
            });

            res.json({
                success: true,
                data: stats, // Use data wrapper for consistency (Phase 7)
                stats // Backward compatibility
            });

        } catch (error) {
            next(error);
        }
    }
};

module.exports = liveController;
