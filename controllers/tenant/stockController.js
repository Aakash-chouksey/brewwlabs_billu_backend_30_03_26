/**
 * Stock Controller - Neon-Safe Version
 * Standardized for transaction-scoped model access
 */

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

const stockController = {
    /**
     * Purchase stock (add to inventory)
     */
    purchaseStock: async (req, res, next) => {
        try {
            const business_id = req.business_id || req.businessId;
            const outlet_id = req.outlet_id || req.outletId;
            const user_id = req.user?.id;
            const { inventoryId, quantity, costPerUnit, purchaseDate, supplierId, invoiceNumber } = req.body;

            const txn = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Inventory, InventoryTransaction } = models;

                // Add to inventory
                const inventory = await Inventory.findOne({
                    where: { id: inventoryId || req.body.inventoryItemId, businessId: business_id },
                    transaction
                });

                if (!inventory) {
                    throw new Error('Inventory item not found');
                }

                const oldQty = Number(inventory.quantity || 0);
                const newQty = oldQty + Number(quantity);

                await inventory.update({ quantity: newQty }, { transaction });

                // Record transaction
                return await InventoryTransaction.create({
                    id: uuidv4(),
                    businessId: business_id,
                    outletId: outlet_id,
                    inventoryId: inventory.id,
                    type: 'PURCHASE',
                    quantity: Number(quantity),
                    unitCost: Number(costPerUnit),
                    totalCost: Number(quantity) * Number(costPerUnit),
                    previousQuantity: oldQty,
                    newQuantity: newQty,
                    supplierId,
                    invoiceNumber,
                    notes: `Stock purchase: ${invoiceNumber || 'N/A'}`,
                    performedBy: user_id
                }, { transaction });
            });

            res.status(201).json({
                success: true,
                message: 'Stock purchased successfully',
                data: txn
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Self consume stock (for recipes)
     */
    selfConsumeStock: async (req, res, next) => {
        try {
            const business_id = req.business_id || req.businessId;
            const outlet_id = req.outlet_id || req.outletId;
            const user_id = req.user?.id;
            const { inventoryId, quantity, reason } = req.body;

            const txn = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Inventory, InventoryTransaction } = models;

                // Check stock
                const inventory = await Inventory.findOne({
                    where: { id: inventoryId || req.body.inventoryItemId, businessId: business_id },
                    transaction
                });

                if (!inventory || Number(inventory.quantity || 0) < Number(quantity)) {
                    throw new Error(`Insufficient stock. Available: ${inventory?.quantity || 0}`);
                }

                const oldQty = Number(inventory.quantity || 0);
                const newQty = oldQty - Number(quantity);

                // Deduct from inventory
                await inventory.update({ quantity: newQty }, { transaction });

                // Record transaction
                return await InventoryTransaction.create({
                    id: uuidv4(),
                    businessId: business_id,
                    outletId: outlet_id,
                    inventoryId: inventory.id,
                    type: 'SELF_CONSUME',
                    quantity: -Number(quantity),
                    previousQuantity: oldQty,
                    newQuantity: newQty,
                    reason,
                    notes: `Self consumption: ${reason || 'N/A'}`,
                    performedBy: user_id
                }, { transaction });
            });

            res.json({
                success: true,
                message: 'Stock consumed successfully',
                data: txn
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Adjust stock
     */
    adjustStock: async (req, res, next) => {
        try {
            const business_id = req.business_id || req.businessId;
            const outlet_id = req.outlet_id || req.outletId;
            const user_id = req.user?.id;
            const { inventoryId, quantity, adjustmentType, reason } = req.body;

            const txn = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Inventory, InventoryTransaction } = models;

                const inventory = await Inventory.findOne({
                    where: { id: inventoryId || req.body.inventoryItemId, businessId: business_id },
                    transaction
                });

                if (!inventory) {
                    throw new Error('Inventory item not found');
                }

                const oldQty = Number(inventory.quantity || 0);
                const adjustQty = adjustmentType === 'ADD' ? Number(quantity) : -Number(quantity);
                const newQty = oldQty + adjustQty;

                if (newQty < 0) {
                    throw new Error('Adjustment would result in negative stock');
                }

                // Update stock
                await inventory.update({ quantity: newQty }, { transaction });

                // Record transaction
                return await InventoryTransaction.create({
                    id: uuidv4(),
                    businessId: business_id,
                    outletId: outlet_id,
                    inventoryId: inventory.id,
                    type: 'ADJUSTMENT',
                    quantity: adjustQty,
                    previousQuantity: oldQty,
                    newQuantity: newQty,
                    reason,
                    notes: `Stock adjustment: ${reason || 'Manual'}`,
                    performedBy: user_id
                }, { transaction });
            });

            res.json({
                success: true,
                message: 'Stock adjusted successfully',
                data: txn
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Get all adjustments/transactions
     */
    getTransactions: async (req, res, next) => {
        try {
            const business_id = req.business_id || req.businessId;
            const { inventoryId, type, startDate, endDate } = req.query;

            const transactions = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { InventoryTransaction, Inventory, Product } = models;

                const whereClause = { businessId: business_id };
                if (inventoryId || req.query.inventoryItemId) {
                    whereClause.inventoryId = inventoryId || req.query.inventoryItemId;
                }
                if (type) whereClause.type = type;
                if (startDate && endDate) {
                    whereClause.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
                }

                return await InventoryTransaction.findAll({
                    where: whereClause,
                    include: [{ 
                        model: Inventory, 
                        as: 'inventory',
                        include: [{ 
                            model: Product, 
                            as: 'product', 
                            attributes: ['id', 'name', 'sku', 'price', 'isActive'] 
                        }] 
                    }],
                    order: [['created_at', 'DESC']]
                });
            });

            res.json({
                success: true,
                data: transactions,
                message: "Transactions retrieved successfully"
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Get low stock items
     */
    getLowStockItems: async (req, res, next) => {
        try {
            const business_id = req.business_id || req.businessId;

            const items = await req.readWithTenant(async (context) => {
                const { transactionModels: models, sequelize } = context;
                const { Inventory, Product } = models;

                return await Inventory.findAll({
                    where: {
                        businessId: business_id,
                        quantity: { [Op.lte]: sequelize.col('reorder_level') }
                    },
                    include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'sku'] }],
                    order: [['quantity', 'ASC']]
                });
            });

            res.json({
                success: true,
                data: items,
                count: items.length,
                message: "Low stock items retrieved successfully"
            });

        } catch (error) {
            next(error);
        }
    }
};

// Legacy compatibility
stockController.createAdjustment = stockController.adjustStock;
stockController.getAdjustments = stockController.getTransactions;

module.exports = stockController;
