/**
 * INVENTORY DASHBOARD CONTROLLER - Neon-Safe Transaction Pattern
 */

const { Op } = require("sequelize");

/**
 * Get inventory dashboard summary
 */
exports.getDashboardSummary = async (req, res, next) => {
    try {
        const { businessId, outletId } = req;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Inventory, InventoryTransaction, Product, sequelize } = models;
            
            const whereClause = { businessId };
            if (outletId) whereClause.outletId = outletId;

            // 1. Fetch all inventory with products for combined processing (Efficient)
            const allInventory = await Inventory.findAll({
                where: whereClause,
                include: [{ model: Product, as: 'product' }]
            });

            // 2. Process data in memory (Fast)
            const totalItems = allInventory.length;
            let lowStockCount = 0;
            let totalValue = 0;

            allInventory.forEach(item => {
                // Determine reorder level (prefer item-specific over product-default)
                const reorderLevel = item.reorderLevel || item.product?.reorderLevel || 10;
                if (Number(item.quantity) <= reorderLevel) {
                    lowStockCount++;
                }
                totalValue += (Number(item.quantity) * (Number(item.unitCost) || 0));
            });

            // 3. Recent transactions (last 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const recentTransactions = await InventoryTransaction.count({
                where: {
                    ...whereClause,
                    createdAt: { [Op.gte]: sevenDaysAgo }
                }
            });

            // 4. Transaction summary by type
            const transactionTypes = await InventoryTransaction.findAll({
                where: whereClause,
                attributes: ['type', [sequelize.fn('COUNT', '*'), 'count']],
                group: ['type']
            });

            return {
                totalItems,
                lowStockItems: lowStockCount,
                totalValue: Math.round(totalValue * 100) / 100,
                recentTransactions,
                transactionSummary: transactionTypes.map(t => ({
                    type: t.type,
                    count: parseInt(t.get('count'))
                }))
            };
        });

        console.log('[INVENTORY DASHBOARD CONTROLLER] getDashboardSummary result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData });
    } catch (error) {
        next(error);
    }
};
