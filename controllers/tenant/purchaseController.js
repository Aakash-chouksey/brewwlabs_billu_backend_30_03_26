/**
 * Purchase Controller - Neon-Safe Version
 * Standardized for transaction-scoped model access
 */

const { v4: uuidv4 } = require('uuid');

const purchaseController = {
    /**
     * Get all purchases
     */
    getPurchases: async (req, res, next) => {
        try {
            const { businessId } = req;

            const purchases = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { Purchase, Supplier, PurchaseItem } = models;

                return await Purchase.findAll({
                    where: { businessId },
                    order: [['purchaseDate', 'DESC']],
                    include: [
                        { model: Supplier, as: 'supplier' },
                        { model: PurchaseItem, as: 'items' }
                    ]
                });
            });

            res.json({
                success: true,
                data: purchases
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Add new purchase
     */
    addPurchase: async (req, res, next) => {
        try {
            const { businessId } = req;
            const { supplierId, items, totalAmount, purchaseDate, invoiceNumber } = req.body;

            const purchase = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Purchase, Inventory } = models;

                // Create purchase record
                const newPurchase = await Purchase.create({
                    id: uuidv4(),
                    businessId,
                    supplierId,
                    total: totalAmount, // Standardized field name
                    purchaseDate: purchaseDate || new Date(),
                    invoiceNumber,
                    status: 'RECEIVED'
                }, { transaction });

                // Update inventory for each item
                if (items && Array.isArray(items)) {
                    for (const item of items) {
                        const inventoryId = item.inventoryId || item.inventoryItemId;
                        if (!inventoryId) continue;

                        await Inventory.increment('quantity', {
                            by: Number(item.quantity || 0),
                            where: { id: inventoryId, businessId },
                            transaction
                        });
                    }
                }

                return newPurchase;
            });

            res.status(201).json({
                success: true,
                message: 'Purchase created successfully',
                data: purchase
            });

        } catch (error) {
            next(error);
        }
    }
};

module.exports = purchaseController;
