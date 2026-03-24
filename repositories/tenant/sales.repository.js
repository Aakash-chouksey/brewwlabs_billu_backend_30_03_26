const { Sequelize, Op } = require('sequelize');
const { assertTransaction, assertTenant } = require('../../src/utils/guards');

/**
 * Sales Repository - DATA-FIRST REFACTORED
 */
const salesRepository = {
    /**
     * Get Daily Sales Summary
     */
    getDailySales: async ({ models, transaction, businessId, outletId, filters = {} }) => {
        assertTransaction(transaction);
        assertTenant(businessId);
        
        const { Order } = models;
        const { startDate, endDate } = filters;

        const where = { 
            businessId, 
            outletId,
            status: 'CLOSED'
        };

        if (startDate && endDate) {
            where.createdAt = { [Op.between]: [startDate, endDate] };
        }

        return await Order.findAll({
            attributes: [
                [Sequelize.fn('DATE', Sequelize.col('created_at')), 'date'],
                [Sequelize.fn('COUNT', Sequelize.col('id')), 'total_orders'],
                [Sequelize.fn('SUM', Sequelize.col('billing_total')), 'revenue']
            ],
            where,
            group: [Sequelize.fn('DATE', Sequelize.col('created_at'))],
            order: [[Sequelize.fn('DATE', Sequelize.col('created_at')), 'DESC']],
            raw: true,
            transaction
        });
    },

    /**
     * Get Item-wise Sales
     */
    getItemSales: async ({ models, transaction, businessId, outletId, filters = {} }) => {
        assertTransaction(transaction);
        assertTenant(businessId);

        const { OrderItem } = models;
        const { startDate, endDate } = filters;

        const where = { businessId, outletId };
        if (startDate && endDate) {
            where.createdAt = { [Op.between]: [startDate, endDate] };
        }

        const results = await OrderItem.findAll({
            attributes: [
                'name',
                [Sequelize.fn('SUM', Sequelize.col('quantity')), 'total_sold'],
                [Sequelize.fn('SUM', Sequelize.col('subtotal')), 'totalRevenue']
            ],
            where,
            group: ['name'],
            order: [[Sequelize.literal('total_sold'), 'DESC']],
            raw: true,
            transaction
        });

        return results.map(result => ({
            name: result.name || 'Unknown Item',
            total_sold: parseInt(result.total_sold || 0),
            totalRevenue: parseFloat(result.totalRevenue || 0)
        }));
    },

    /**
     * Get Category-wise Sales (Raw Query)
     */
    getCategorySales: async ({ models, transaction, businessId, outletId, filters = {} }) => {
        assertTransaction(transaction);
        assertTenant(businessId);

        const { sequelize } = models;
        const { startDate, endDate } = filters;

        const query = `
            SELECT 
                c.name as category, 
                SUM(CAST(item_data->>'price' AS DECIMAL) * CAST(item_data->>'qty' AS INTEGER)) as "totalRevenue"
            FROM "orders" o
            CROSS JOIN jsonb_array_elements(o.items) as item_data
            LEFT JOIN "categories" c ON CAST(item_data->>'categoryId' AS UUID) = c.id
            WHERE o."business_id" = :businessId 
            AND o."outlet_id" = :outletId
            AND o."status" = 'CLOSED'
            ${startDate && endDate ? 'AND o."created_at" BETWEEN :startDate AND :endDate' : ''}
            GROUP BY c.name
            ORDER BY "totalRevenue" DESC
        `;

        const results = await sequelize.query(query, {
            replacements: { businessId, outletId, startDate, endDate },
            type: sequelize.QueryTypes.SELECT,
            transaction
        });

        return results.map(result => ({
            category: result.category || 'Uncategorized',
            totalRevenue: parseFloat(result.totalRevenue || 0)
        }));
    },

    /**
     * Get Dashboard Metrics
     */
    getDashboardMetrics: async ({ models, transaction, businessId, outletId }) => {
        assertTransaction(transaction);
        assertTenant(businessId);

        const { Order, OrderItem } = models;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const whereToday = {
            businessId,
            outletId,
            createdAt: { [Op.gte]: today },
            status: 'CLOSED'
        };

        const todayMetrics = await Order.findOne({
            attributes: [
                [Sequelize.fn('SUM', Sequelize.col('billing_total')), 'totalRevenue'],
                [Sequelize.fn('COUNT', Sequelize.col('id')), 'total_orders']
            ],
            where: whereToday,
            raw: true,
            transaction
        });

        const topProduct = await OrderItem.findOne({
            attributes: [
                'name',
                [Sequelize.fn('SUM', Sequelize.col('quantity')), 'total_sold']
            ],
            where: { businessId, outletId, createdAt: { [Op.gte]: today } },
            group: ['name'],
            order: [[Sequelize.literal('total_sold'), 'DESC']],
            raw: true,
            transaction
        });

        return {
            revenueToday: parseFloat(todayMetrics?.totalRevenue || 0),
            ordersToday: parseInt(todayMetrics?.total_orders || 0),
            topProduct: topProduct?.name || 'N/A'
        };
    }
};

module.exports = salesRepository;
