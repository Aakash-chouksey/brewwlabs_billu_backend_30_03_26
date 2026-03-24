/**
 * INVENTORY SALE CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");
const { Op } = require("sequelize");

/**
 * Add inventory sale
 */
exports.addInventorySale = async (req, res, next) => {
    try {
        const { businessId, outletId } = req;
        const { inventoryId, quantity, price, customerId, notes } = req.body;

        if (!inventoryId || !quantity || !price) {
            throw createHttpError(400, "Inventory ID, quantity, and price are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { InventorySale, Inventory, InventoryTransaction, Product } = models;
            
            // Check inventory availability
            const inventory = await Inventory.findOne({
                where: { id: inventoryId, businessId, ...(outletId && { outletId }) },
                include: [{ model: Product, as: 'product' }],
                transaction
            });
            
            if (!inventory) throw createHttpError(404, "Inventory item not found");
            
            const currentQty = Number(inventory.quantity || 0);
            const saleQty = parseInt(quantity);
            
            if (currentQty < saleQty) {
                throw createHttpError(400, `Insufficient stock. Available: ${currentQty}`);
            }

            const oldQty = currentQty;
            const newQty = oldQty - saleQty;

            // Update inventory
            await inventory.update({ quantity: newQty }, { transaction });

            // Create inventory transaction
            await InventoryTransaction.create({
                businessId,
                outletId,
                inventoryId,
                productId: inventory.productId,
                type: 'SALE',
                quantity: saleQty,
                unitCost: inventory.unitCost || 0,
                totalCost: (inventory.unitCost || 0) * saleQty,
                previousQuantity: oldQty,
                newQuantity: newQty,
                notes: notes || 'Inventory sale',
                performedBy: req.auth?.id
            }, { transaction });

            // Create sale record
            const sale = await InventorySale.create({
                businessId,
                outletId,
                inventoryId,
                productId: inventory.productId,
                quantity: saleQty,
                unitPrice: price,
                totalAmount: price * saleQty,
                customerId,
                notes,
                soldBy: req.auth?.id
            }, { transaction });

            return { sale, inventory, product: inventory.product };
        });

        res.status(201).json({ success: true, data: result, message: "Inventory sale recorded" });
    } catch (error) {
        next(error);
    }
};

/**
 * Get inventory sales
 */
exports.getInventorySales = async (req, res, next) => {
    try {
        const { businessId, outletId } = req;
        const { startDate, endDate, productId } = req.query;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { InventorySale, Inventory, Product, Customer } = models;
            
            const whereClause = { businessId };
            if (outletId) whereClause.outletId = outletId;
            if (productId) whereClause.productId = productId;
            if (startDate && endDate) {
                whereClause.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
            }

            return await InventorySale.findAll({
                where: whereClause,
                include: [
                    { model: Inventory },
                    { model: Product, attributes: ['id', 'name', 'sku'] },
                    { model: Customer, attributes: ['id', 'name', 'phone'] }
                ],
                order: [['createdAt', 'DESC']]
            });
        });

        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};
