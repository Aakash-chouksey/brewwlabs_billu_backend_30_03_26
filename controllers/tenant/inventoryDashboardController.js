/**
 * INVENTORY DASHBOARD CONTROLLER - Neon-Safe Transaction Pattern
 */

const { Op } = require("sequelize");

/**
 * Get inventory dashboard summary
 */
exports.getDashboardSummary = async (req, res, next) => {
    try {
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models, sequelize } = context;
            const { Inventory, InventoryTransaction, Product } = models;
            
            const whereClause = { businessId: business_id };
            if (outlet_id) whereClause.outletId = outlet_id;

            // Fetch all inventory with products for combined processing
            const allInventory = await Inventory.findAll({
                where: whereClause,
                include: [{ model: Product, as: 'product' }]
            });

            let lowStockCount = 0;
            let totalValue = 0;

            allInventory.forEach(item => {
                const reorderLevel = item.reorderLevel || item.product?.reorderLevel || 10;
                if (Number(item.quantity) <= reorderLevel) {
                    lowStockCount++;
                }
                totalValue += (Number(item.quantity) * (Number(item.unitCost) || 0));
            });

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const [recentTransactionsCount, transactionSummary] = await Promise.all([
                InventoryTransaction.count({
                    where: {
                        ...whereClause,
                        createdAt: { [Op.gte]: sevenDaysAgo }
                    }
                }),
                InventoryTransaction.findAll({
                    where: whereClause,
                    attributes: ['type', [sequelize.fn('COUNT', '*'), 'count']],
                    group: ['type']
                })
            ]);

            return {
                totalItems: allInventory.length,
                lowStockItems: lowStockCount,
                totalValue: Math.round(totalValue * 100) / 100,
                recentTransactions: recentTransactionsCount,
                transactionSummary: transactionSummary.map(t => ({
                    type: t.type,
                    count: parseInt(t.get('count'))
                }))
            };
        });

        const data = result.data || result;
        res.json({ 
            success: true, 
            data: data,
            message: "Inventory dashboard summary retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};
