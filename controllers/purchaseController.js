/**
 * PURCHASE CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");
const { Op } = require("sequelize");

/**
 * Add purchase
 */
exports.addPurchase = async (req, res, next) => {
    try {
        const { businessId, outletId } = req;
        const { supplierId, items, invoiceNumber, notes, totalAmount } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            throw createHttpError(400, "Purchase items are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Purchase, PurchaseItem, Inventory, Product, InventoryTransaction } = models;
            
            // Create purchase
            const purchase = await Purchase.create({
                businessId,
                outletId,
                supplierId,
                invoiceNumber,
                notes,
                totalAmount: totalAmount || 0,
                status: 'RECEIVED',
                createdBy: req.auth?.id
            }, { transaction });

            // Process items
            let calculatedTotal = 0;
            const purchaseItems = [];

            for (const item of items) {
                const product = await Product.findOne({
                    where: { id: item.productId, businessId },
                    transaction
                });
                if (!product) throw createHttpError(404, `Product ${item.productId} not found`);

                const itemTotal = (item.unitPrice || 0) * item.quantity;
                calculatedTotal += itemTotal;

                const pi = await PurchaseItem.create({
                    purchaseId: purchase.id,
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice || 0,
                    total: itemTotal,
                    notes: item.notes || ''
                }, { transaction });

                purchaseItems.push(pi);

                // Update/add inventory
                let [inventory, created] = await Inventory.findOrCreate({
                    where: { businessId, outletId, productId: item.productId },
                    defaults: { quantity: 0, unitCost: item.unitPrice || 0 },
                    transaction
                });

                const oldQty = inventory.quantity;
                const newQty = oldQty + item.quantity;

                await inventory.update({
                    quantity: newQty,
                    unitCost: item.unitPrice || inventory.unitCost,
                    lastRestockedAt: new Date()
                }, { transaction });

                // Create inventory transaction
                await InventoryTransaction.create({
                    businessId,
                    outletId,
                    inventoryId: inventory.id,
                    productId: item.productId,
                    type: 'PURCHASE',
                    quantity: item.quantity,
                    unitCost: item.unitPrice || inventory.unitCost,
                    totalCost: (item.unitPrice || inventory.unitCost) * item.quantity,
                    previousQuantity: oldQty,
                    newQuantity: newQty,
                    notes: `Purchase #${purchase.id}`,
                    performedBy: req.auth?.id
                }, { transaction });
            }

            // Update purchase total if not provided
            if (!totalAmount) {
                await purchase.update({ totalAmount: calculatedTotal }, { transaction });
            }

            return { purchase, items: purchaseItems };
        });

        console.log('[PURCHASE CONTROLLER] addPurchase result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.status(201).json({ success: true, data: responseData, message: "Purchase recorded" });
    } catch (error) {
        next(error);
    }
};

/**
 * Get purchases
 */
exports.getPurchases = async (req, res, next) => {
    try {
        const { businessId, outletId } = req;
        const { supplierId, startDate, endDate, status } = req.query;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Purchase, PurchaseItem, Product, Supplier } = models;
            
            const whereClause = { businessId };
            if (outletId) whereClause.outletId = outletId;
            if (supplierId) whereClause.supplierId = supplierId;
            if (status) whereClause.status = status;
            if (startDate && endDate) {
                whereClause.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
            }

            return await Purchase.findAll({
                where: whereClause,
                include: [
                    { model: PurchaseItem, as: 'purchaseItems', include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }] },
                    { model: Supplier, as: 'supplier', attributes: ['id', 'name', 'phone'] }
                ],
                order: [['created_at', 'DESC']]
            });
        });

        console.log('[PURCHASE CONTROLLER] getPurchases result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData });
    } catch (error) {
        next(error);
    }
};
