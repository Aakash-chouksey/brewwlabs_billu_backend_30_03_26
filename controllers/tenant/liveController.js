/**
 * LIVE CONTROLLER - Neon-Safe Version
 * Standardized for transaction-scoped model access and real-time POS monitoring
 */

const { Op } = require('sequelize');

const liveController = {
    /**
     * Get live orders
     */
    getLiveOrders: async (req, res, next) => {
        try {
            const business_id = req.business_id || req.businessId;
            const outlet_id = req.outlet_id || req.outletId;

            const result = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { Order, OrderItem, Product, Table, Customer } = models;

                return await Order.findAll({
                    where: {
                        businessId: business_id,
                        outletId: outlet_id,
                        status: {
                            [Op.in]: ['CREATED', 'KOT_SENT']
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

            const data = result.data || result || [];
            console.log("LIVE ORDERS RESPONSE:", data.length);

            res.json({
                success: true,
                data: data,
                count: data.length,
                message: "Live orders retrieved successfully"
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
            const business_id = req.business_id || req.businessId;
            const outlet_id = req.outlet_id || req.outletId;

            const result = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { Order, Table } = models;

                // Get today's date range
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                const [
                    activeOrdersCount,
                    todayOrdersCount,
                    todayRevenueSum,
                    occupiedTablesCount,
                    totalTablesCount
                ] = await Promise.all([
                    Order.count({
                        where: {
                            businessId: business_id,
                            outletId: outlet_id,
                            status: { [Op.notIn]: ['COMPLETED', 'CANCELLED'] }
                        }
                    }),
                    Order.count({
                        where: {
                            businessId: business_id,
                            outletId: outlet_id,
                            createdAt: { [Op.gte]: today, [Op.lt]: tomorrow }
                        }
                    }),
                    Order.sum('billingTotal', { // Standardized field mapping
                        where: {
                            businessId: business_id,
                            outletId: outlet_id,
                            createdAt: { [Op.gte]: today, [Op.lt]: tomorrow },
                            status: { [Op.notIn]: ['CANCELLED'] }
                        }
                    }) || 0,
                    Table.count({
                        where: {
                            businessId: business_id,
                            outletId: outlet_id,
                            status: 'OCCUPIED'
                        }
                    }),
                    Table.count({
                        where: { businessId: business_id, outletId: outlet_id }
                    })
                ]);

                return {
                    activeOrders: activeOrdersCount,
                    todayOrders: todayOrdersCount,
                    todayRevenue: Number(todayRevenueSum || 0),
                    occupiedTables: occupiedTablesCount,
                    totalTables: totalTablesCount,
                    tableUtilization: totalTablesCount > 0 ? Math.round((occupiedTablesCount / totalTablesCount) * 100) : 0
                };
            });

            const data = result.data || result;

            res.json({
                success: true,
                data: data,
                message: "Live statistics retrieved successfully"
            });

        } catch (error) {
            next(error);
        }
    }
};

module.exports = liveController;
