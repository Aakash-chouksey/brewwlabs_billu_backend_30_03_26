/**
 * PURCHASE CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");
const { Op } = require("sequelize");

/**
 * Add purchase - OPTIMIZED: Eliminated N+1 queries
 */
exports.addPurchase = async (req, res, next) => {
    try {
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;
        const { supplierId, items, invoiceNumber, notes, totalAmount } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            throw createHttpError(400, "Purchase items are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Purchase, PurchaseItem, Inventory, Product, InventoryTransaction } = models;
            
            // OPTIMIZATION 1: Batch fetch all products in a single query
            const productIds = [...new Set(items.map(i => i.productId))];
            const products = await Product.findAll({
                where: { id: { [Op.in]: productIds }, businessId: business_id },
                transaction
            });
            
            const productMap = products.reduce((acc, p) => {
                acc[p.id] = p;
                return acc;
            }, {});

            // Validate all products exist
            for (const item of items) {
                if (!productMap[item.productId]) {
                    throw createHttpError(404, `Product ${item.productId} not found`);
                }
            }

            // Create purchase record
            const purchase = await Purchase.create({
                businessId: business_id,
                outletId: outlet_id,
                supplierId,
                invoiceNumber,
                notes,
                totalAmount: Number(totalAmount) || 0,
                status: 'RECEIVED',
                createdBy: req.user?.id
            }, { transaction });

            let calculatedTotal = 0;
            const purchaseItemsData = [];
            const inventoryUpdates = [];
            const inventoryTransactionDataRaw = [];

            for (const item of items) {
                const product = productMap[item.productId];
                const itemTotal = (Number(item.unitPrice) || 0) * Number(item.quantity);
                calculatedTotal += itemTotal;

                purchaseItemsData.push({
                    purchaseId: purchase.id,
                    productId: item.productId,
                    quantity: Number(item.quantity),
                    unitPrice: Number(item.unitPrice) || 0,
                    total: itemTotal,
                    notes: item.notes || ''
                });

                inventoryUpdates.push({
                    productId: item.productId,
                    quantity: Number(item.quantity),
                    unitPrice: Number(item.unitPrice) || 0
                });

                inventoryTransactionDataRaw.push({
                    businessId: business_id,
                    outletId: outlet_id,
                    productId: item.productId,
                    type: 'PURCHASE',
                    quantity: Number(item.quantity),
                    unitCost: Number(item.unitPrice) || 0,
                    totalCost: itemTotal,
                    notes: `Purchase #${purchase.id} - ${invoiceNumber || 'No Invoice'}`,
                    performedBy: req.user?.id
                });
            }

            // Bulk create purchase items
            await PurchaseItem.bulkCreate(purchaseItemsData, { transaction });

            // Fetch existing inventory
            const existingInventory = await Inventory.findAll({
                where: { 
                    businessId: business_id, 
                    outletId: outlet_id, 
                    productId: { [Op.in]: productIds } 
                },
                transaction
            });

            const inventoryMap = existingInventory.reduce((acc, inv) => {
                acc[inv.productId] = inv;
                return acc;
            }, {});

            const inventoryTransactionRecords = [];

            for (const update of inventoryUpdates) {
                let inventory = inventoryMap[update.productId];
                let oldQty = 0;
                
                if (inventory) {
                    oldQty = Number(inventory.quantity || 0);
                    const newQty = oldQty + update.quantity;
                    
                    await inventory.update({
                        quantity: newQty,
                        unitCost: update.unitPrice,
                        lastRestockedAt: new Date()
                    }, { transaction });
                } else {
                    inventory = await Inventory.create({
                        businessId: business_id,
                        outletId: outlet_id,
                        productId: update.productId,
                        quantity: update.quantity,
                        unitCost: update.unitPrice,
                        lastRestockedAt: new Date()
                    }, { transaction });
                }

                inventoryTransactionRecords.push({
                    ...inventoryTransactionDataRaw.find(t => t.productId === update.productId),
                    inventoryId: inventory.id,
                    previousQuantity: oldQty,
                    newQuantity: oldQty + update.quantity
                });
            }

            // Bulk create inventory transactions
            if (inventoryTransactionRecords.length > 0) {
                await InventoryTransaction.bulkCreate(inventoryTransactionRecords, { transaction });
            }

            // Update purchase total if not provided
            if (!totalAmount) {
                await purchase.update({ totalAmount: calculatedTotal }, { transaction });
            }

            return { purchase, itemsCount: items.length };
        });

        const responseData = result.data || result;
        res.status(201).json({ 
            success: true, 
            data: responseData, 
            message: "Purchase recorded successfully" 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get purchases
 */
exports.getPurchases = async (req, res, next) => {
    try {
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;
        const { supplierId, startDate, endDate, status } = req.query;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Purchase, PurchaseItem, Product, Supplier } = models;
            
            const whereClause = { businessId: business_id };
            if (outlet_id) whereClause.outletId = outlet_id;
            if (supplierId) whereClause.supplierId = supplierId;
            if (status) whereClause.status = status;
            if (startDate && endDate) {
                whereClause.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
            }

            return await Purchase.findAll({
                where: whereClause,
                include: [
                    { 
                        model: PurchaseItem, 
                        as: 'items', // Adjusted to match standardized alias if changed
                        include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }] 
                    },
                    { model: Supplier, as: 'supplier', attributes: ['id', 'name', 'phone'] }
                ],
                order: [['created_at', 'DESC']]
            });
        });

        const responseData = result.data || result || [];
        res.json({ 
            success: true, 
            data: responseData,
            message: "Purchases retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};
