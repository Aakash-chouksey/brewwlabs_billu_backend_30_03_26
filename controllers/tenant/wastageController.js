/**
 * Wastage Controller - Neon-Safe Version
 * Standardized for transaction-scoped model access
 */

const { v4: uuidv4 } = require('uuid');

const wastageController = {
    /**
     * Get all wastage records
     */
    getWastageRecords: async (req, res, next) => {
        try {
            const business_id = req.business_id || req.businessId;
            const outlet_id = req.outlet_id || req.outletId;

            const records = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { Wastage, Inventory, InventoryItem, Product, InventoryCategory } = models;

                const whereClause = { businessId: business_id };
                if (outlet_id) whereClause.outletId = outlet_id;

                return await Wastage.findAll({
                    where: whereClause,
                    order: [['wastage_date', 'DESC']],
                    include: [
                        { 
                            model: Inventory, 
                            as: 'inventory',
                            required: false,
                            include: [{ model: Product, as: 'product', attributes: ['name', 'sku'] }]
                        },
                        {
                            model: InventoryItem,
                            as: 'inventoryItem',
                            required: false,
                            include: [{ model: InventoryCategory, as: 'category', attributes: ['name'] }]
                        }
                    ]
                });
            });

            res.json({
                success: true,
                data: records,
                message: "Wastage records retrieved successfully"
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Add wastage record
     */
    addWastageRecord: async (req, res, next) => {
        try {
            const business_id = req.business_id || req.businessId;
            const outlet_id = req.outlet_id || req.outletId;
            const user_id = req.user?.id;
            const { inventoryId, inventoryItemId, quantity, reason, wastageDate, notes } = req.body;

            const wastage = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Wastage, Inventory, InventoryItem } = models;

                let targetItem = null;
                let sourceType = null;
                const primaryId = inventoryId || inventoryItemId || req.body.id;

                if (!primaryId) {
                    throw new Error('No inventory item ID provided');
                }

                // 1. Try Inventory (Product Store)
                targetItem = await Inventory.findOne({
                    where: { id: primaryId, businessId: business_id },
                    transaction
                });

                if (targetItem) {
                    sourceType = 'INVENTORY';
                } else {
                    // 2. Try InventoryItem (Raw Materials)
                    targetItem = await InventoryItem.findOne({
                        where: { id: primaryId, businessId: business_id },
                        transaction
                    });
                    if (targetItem) sourceType = 'RAW_MATERIAL';
                }

                if (!targetItem) {
                    throw new Error(`Inventory item not found: ${primaryId}`);
                }

                const currentStock = Number(targetItem.quantity !== undefined ? targetItem.quantity : targetItem.currentStock || 0);
                if (currentStock < Number(quantity)) {
                    throw new Error(`Insufficient stock. Available: ${currentStock}`);
                }

                const costPerUnit = Number(targetItem.costPerUnit || (targetItem.product?.costPrice) || 0);

                // Create wastage record
                const newWastage = await Wastage.create({
                    id: uuidv4(),
                    businessId: business_id,
                    outletId: outlet_id,
                    inventoryId: sourceType === 'INVENTORY' ? targetItem.id : null,
                    inventoryItemId: sourceType === 'RAW_MATERIAL' ? targetItem.id : null,
                    quantity: Number(quantity),
                    reason: reason || 'OTHER',
                    wastageDate: wastageDate || new Date(),
                    notes,
                    recordedBy: user_id,
                    costValue: costPerUnit * Number(quantity)
                }, { transaction });

                // Deduct from correct table
                if (sourceType === 'INVENTORY') {
                    await targetItem.decrement('quantity', { by: Number(quantity), transaction });
                } else {
                    await targetItem.decrement('current_stock', { by: Number(quantity), transaction });
                }

                return newWastage;
            });

            res.status(201).json({
                success: true,
                message: 'Wastage record created successfully',
                data: wastage
            });

        } catch (error) {
            next(error);
        }
    },

    /**
     * Delete wastage record
     */
    deleteWastageRecord: async (req, res, next) => {
        try {
            const { id } = req.params;
            const business_id = req.business_id || req.businessId;

            await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Wastage } = models;

                const record = await Wastage.findOne({
                    where: { id, businessId: business_id },
                    transaction
                });

                if (!record) {
                    throw new Error('Wastage record not found');
                }

                await record.destroy({ transaction });
            });

            res.json({
                success: true,
                message: 'Wastage record deleted successfully'
            });

        } catch (error) {
            next(error);
        }
    }
};

module.exports = wastageController;
