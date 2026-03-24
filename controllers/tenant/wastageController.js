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
            const { businessId } = req;

            const records = await req.readWithTenant(async (context) => {
                const { transactionModels: models } = context;
                const { Wastage, Inventory, Product } = models;

                return await Wastage.findAll({
                    where: { businessId },
                    order: [['wastageDate', 'DESC']],
                    include: [{ 
                        model: Inventory, 
                        as: 'inventory',
                        include: [{ model: Product, as: 'product', attributes: ['name', 'sku'] }]
                    }]
                });
            });

            res.json({
                success: true,
                data: records
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
            const { businessId, auth } = req;
            const { inventoryId, quantity, reason, wastageDate, notes } = req.body;

            const wastage = await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Wastage, Inventory } = models;

                // Check inventory item exists
                const inventory = await Inventory.findOne({
                    where: { id: inventoryId || req.body.inventoryItemId, businessId },
                    transaction
                });

                if (!inventory) {
                    throw new Error('Inventory item not found');
                }

                if (Number(inventory.quantity || 0) < Number(quantity)) {
                    throw new Error(`Insufficient stock. Available: ${inventory.quantity}`);
                }

                // Create wastage record
                const newWastage = await Wastage.create({
                    id: uuidv4(),
                    businessId,
                    inventoryId: inventory.id,
                    quantity: Number(quantity),
                    reason,
                    wastageDate: wastageDate || new Date(),
                    notes,
                    recordedBy: auth?.id
                }, { transaction });

                // Deduct from inventory
                await inventory.decrement('quantity', {
                    by: Number(quantity),
                    transaction
                });

                return newWastage;
            });

            res.status(201).json({
                success: true,
                message: 'Wastage record created',
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
            const { businessId } = req;

            await req.executeWithTenant(async (context) => {
                const { transaction, transactionModels: models } = context;
                const { Wastage } = models;

                const record = await Wastage.findOne({
                    where: { id, businessId },
                    transaction
                });

                if (!record) {
                    throw new Error('Wastage record not found');
                }

                await record.destroy({ transaction });
            });

            res.json({
                success: true,
                message: 'Wastage record deleted'
            });

        } catch (error) {
            next(error);
        }
    }
};

module.exports = wastageController;
