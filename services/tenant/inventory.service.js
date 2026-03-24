/**
 * Inventory Service - Neon-Safe Version
 * Aligned with the new middleware-driven transaction pattern
 */

const createHttpError = require('http-errors');

class InventoryService {
    /**
     * Get items with business logic (e.g., low stock check)
     */
    async getItems(req) {
        const { category, lowStock, search } = req.query;
        const { businessId, outletId } = req;

        return await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Inventory, Product } = models;
            
            // Build where clause
            const whereClause = { businessId, outletId };
            if (category) whereClause.categoryId = category;
            
            const items = await Inventory.findAll({
                where: whereClause,
                include: [{ model: Product, as: 'product' }],
                order: [['quantity', 'ASC']]
            });

            // Domain Logic: Filter by low stock
            if (lowStock === 'true') {
                return items.filter(item => item.quantity <= (item.reorderLevel || 10));
            }

            return items;
        });
    }

    /**
     * Add inventory item
     */
    async addItem(req, itemData) {
        const { productId, quantity, unitCost, location } = itemData;
        const { businessId, outletId } = req;

        return await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Product, Inventory, InventoryTransaction } = models;

            // 1. Verify product
            const product = await Product.findOne({
                where: { id: productId, businessId },
                transaction
            });
            if (!product) throw createHttpError(404, 'Product not found');

            // 2. Find or create inventory
            let inventory = await Inventory.findOne({
                where: { businessId, outletId, productId },
                transaction
            });

            if (!inventory) {
                inventory = await Inventory.create({
                    businessId,
                    outletId,
                    productId,
                    quantity: 0,
                    unitCost: unitCost || 0,
                    location
                }, { transaction });
            }

            // 3. Update quantity
            const oldQty = inventory.quantity;
            const newQty = oldQty + parseInt(quantity);
            await inventory.update({
                quantity: newQty,
                unitCost: unitCost || inventory.unitCost
            }, { transaction });

            // 4. Log transaction
            await InventoryTransaction.create({
                businessId,
                outletId,
                productId,
                inventoryId: inventory.id,
                type: 'ADD',
                quantity: parseInt(quantity),
                previousQuantity: oldQty,
                newQuantity: newQty,
                unitCost: unitCost || inventory.unitCost,
                performedBy: req.auth?.id
            }, { transaction });

            return { id: inventory.id, quantity: newQty };
        });
    }
}

module.exports = new InventoryService();
