const { enforceOutletScope, buildStrictWhereClause } = require("../utils/outletGuard");
const inventoryService = require('../services/tenant/inventory.service');
const createHttpError = require("http-errors");
const inventoryService = require("../services/tenant/inventory.service");
const { enforceOutletScope, buildStrictWhereClause } = require("../utils/outletGuard");
const { safeQuery } = require("../utils/safeQuery");

// ==================== INVENTORY ITEMS ====================

/**
 * Get all inventory items
 */
exports.getItems = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { businessId, outletId } = req;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Inventory, Product } = models;
            
            const { whereClause } = buildStrictWhereClause(req);
            
            return await safeQuery(
                () => Inventory.findAll({
                    where: whereClause,
                    include: [{ model: Product, as: 'product' }],
                    order: [['createdAt', 'DESC']]
                }),
                []
            );
        });

        console.log('[INVENTORY CONTROLLER] getItems result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData || [] });
    } catch (error) {
        next(error);
    }
};

/**
 * Adjust stock level
 */
exports.adjustStock = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { businessId, outletId } = req;
        const { productId, adjustment, unitCost, reason, location } = req.body;

        if (!productId || adjustment === undefined) {
            throw createHttpError(400, "Product ID and adjustment are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Inventory, InventoryTransaction, Product } = models;
            
            const product = await safeQuery(
                () => Product.findOne({
                    where: { id: productId, businessId },
                    transaction
                }),
                null
            );
            if (!product) throw createHttpError(404, "Product not found");

            // Use findOrCreate with proper defaults including outletId
            let [inventory, created] = await Inventory.findOrCreate({
                where: { businessId, outletId, productId },
                defaults: { 
                    businessId,
                    outletId,
                    productId,
                    quantity: 0, 
                    unitCost: unitCost || 0, 
                    location 
                },
                transaction
            });

            const prevQty = parseFloat(inventory.quantity || 0);
            const newQty = prevQty + parseFloat(adjustment);

            await inventory.update({
                quantity: newQty,
                unitCost: unitCost || inventory.unitCost,
                location: location || inventory.location,
                lastRestockedAt: adjustment > 0 ? new Date() : inventory.lastRestockedAt
            }, { transaction });

            // Create transaction log
            await InventoryTransaction.create({
                businessId,
                outletId,
                inventoryId: inventory.id,
                productId,
                type: adjustment >= 0 ? 'STOCK_IN' : 'STOCK_OUT',
                quantity: Math.abs(adjustment),
                unitCost: unitCost || inventory.unitCost,
                totalCost: Math.abs(adjustment) * (unitCost || inventory.unitCost),
                previousQuantity: prevQty,
                newQuantity: newQty,
                performedBy: req.auth?.id,
                reason,
                reference: 'MANUAL_ADJUSTMENT'
            }, { transaction });

            return inventory;
        });

        console.log('[INVENTORY CONTROLLER] adjustStock result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData, message: "Stock adjusted" });
    } catch (error) {
        next(error);
    }
};

/**
 * Get item transactions
 */
exports.getItemTransactions = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { id } = req.params;
        const { businessId, outletId } = req;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { InventoryTransaction } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { inventoryId: id });

            return await safeQuery(
                () => InventoryTransaction.findAll({
                    where: whereClause,
                    order: [['createdAt', 'DESC']],
                    limit: 50
                }),
                []
            );
        });

        console.log('[INVENTORY CONTROLLER] getTransactions result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData || [] });
    } catch (error) {
        next(error);
    }
};

/**
 * Sync all products to inventory
 */
exports.syncAllProducts = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { businessId, outletId } = req;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Product, Inventory } = models;
            
            const products = await Product.findAll({
                where: { businessId, outletId },
                transaction
            });

            console.log(`[INVENTORY] Syncing ${products.length} products for outlet ${outletId}`);

            const syncResults = [];
            for (const product of products) {
                const [inventory, created] = await Inventory.findOrCreate({
                    where: { businessId, outletId, productId: product.id },
                    defaults: {
                        businessId,
                        outletId,
                        productId: product.id,
                        quantity: product.currentStock || 0,
                        unitCost: 0
                    },
                    transaction
                });
                syncResults.push({ id: product.id, created });
            }

            return { syncedCount: products.length, syncResults };
        });

        res.json({ success: true, data: result, message: "Inventory sync complete" });
    } catch (error) {
        next(error);
    }
};

/**
 * Add new inventory item (purchase/self-consume/wastage)
 * REFACTORED: Neon-Safe Transaction Pattern
 */
exports.addItem = async (req, res, next) => {
    enforceOutletScope(req);
    try {
        const { businessId, outletId } = req;
        const { productId, quantity, unitCost, type, notes, location } = req.body;

        if (!productId || !quantity) {
            throw createHttpError(400, "Product ID and quantity are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Inventory, InventoryTransaction, Product } = models;
            
            // Verify product exists
            const product = await Product.findOne({
                where: { id: productId, businessId },
                transaction
            });
            if (!product) throw createHttpError(404, "Product not found");

            // Find or create inventory record
            let [inventory, created] = await Inventory.findOrCreate({
                where: { businessId, ...(outletId && { outletId }), productId },
                defaults: { quantity: 0, unitCost: unitCost || 0, location },
                transaction
            });

            const oldQty = Number(inventory.quantity || 0);
            const newQty = oldQty + parseInt(quantity);

            await inventory.update({
                quantity: newQty,
                unitCost: unitCost || inventory.unitCost,
                location: location || inventory.location,
                lastRestockedAt: new Date()
            }, { transaction });

            // Create transaction record
            const invTransaction = await InventoryTransaction.create({
                businessId,
                outletId,
                inventoryId: inventory.id,
                productId,
                type: type || 'PURCHASE',
                quantity: parseInt(quantity),
                unitCost: unitCost || inventory.unitCost,
                totalCost: (unitCost || inventory.unitCost) * parseInt(quantity),
                previousQuantity: oldQty,
                newQuantity: newQty,
                notes: notes || 'Stock added',
                performedBy: req.auth?.id
            }, { transaction });

            return { inventory, transaction: invTransaction, isNew: created };
        });

        console.log('[INVENTORY CONTROLLER] addItem result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.status(201).json({ 
            success: true, 
            data: responseData,
            message: responseData.isNew ? "Inventory created" : "Inventory updated"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update inventory item
 */
exports.updateItem = async (req, res, next) => {
    enforceOutletScope(req);
    try {
        const { id } = req.params;
        const { businessId, outletId } = req;
        const updateData = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Inventory } = models;
            
            const inventory = await Inventory.findOne({
                where: { id, businessId, ...(outletId && { outletId }) },
                transaction
            });
            if (!inventory) throw createHttpError(404, "Inventory item not found");

            await inventory.update(updateData, { transaction });
            return inventory;
        });

        console.log('[INVENTORY CONTROLLER] updateItem result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData, message: "Inventory updated" });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete inventory item
 */
exports.deleteItem = async (req, res, next) => {
    enforceOutletScope(req);
    try {
        const { id } = req.params;
        const { businessId, outletId } = req;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Inventory, InventoryTransaction } = models;
            
            const inventory = await Inventory.findOne({
                where: { id, businessId, ...(outletId && { outletId }) },
                transaction
            });
            if (!inventory) throw createHttpError(404, "Inventory item not found");

            // Delete related transactions first
            await InventoryTransaction.destroy({
                where: { inventoryId: id },
                transaction
            });

            await inventory.destroy({ transaction });
        });

        res.json({ success: true, message: "Inventory item deleted" });
    } catch (error) {
        next(error);
    }
};

// ==================== STOCK MANAGEMENT ====================

/**
 * Add purchase stock
 */
exports.addPurchase = async (req, res, next) => {
    enforceOutletScope(req);
    try {
        req.body.type = 'PURCHASE';
        return exports.addItem(req, res, next);
    } catch (error) {
        next(error);
    }
};

/**
 * Add self consumption
 */
exports.addSelfConsume = async (req, res, next) => {
    enforceOutletScope(req);
    try {
        const { businessId, outletId } = req;
        const { productId, quantity, notes } = req.body;

        if (!productId || !quantity) {
            throw createHttpError(400, "Product ID and quantity are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Inventory, InventoryTransaction, Product } = models;
            
            const inventory = await Inventory.findOne({
                where: { businessId, ...(outletId && { outletId }), productId },
                include: [{ model: Product, as: 'product' }],
                transaction
            });

            if (!inventory || Number(inventory.quantity || 0) < quantity) {
                throw createHttpError(400, `Insufficient stock. Available: ${inventory?.quantity || 0}`);
            }

            const oldQty = Number(inventory.quantity || 0);
            const newQty = oldQty - parseInt(quantity);

            await inventory.update({ quantity: newQty }, { transaction });

            const invTransaction = await InventoryTransaction.create({
                businessId,
                outletId,
                inventoryId: inventory.id,
                productId,
                type: 'SELF_CONSUME',
                quantity: parseInt(quantity),
                unitCost: inventory.unitCost,
                totalCost: (inventory.unitCost || 0) * parseInt(quantity),
                previousQuantity: oldQty,
                newQuantity: newQty,
                notes: notes || 'Self consumption',
                performedBy: req.auth?.id
            }, { transaction });

            return { inventory, transaction: invTransaction };
        });

        console.log('[INVENTORY CONTROLLER] addSelfConsume result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData, message: "Self consumption recorded" });
    } catch (error) {
        next(error);
    }
};

/**
 * Add wastage
 */
exports.addWastage = async (req, res, next) => {
    enforceOutletScope(req);
    try {
        const { businessId, outletId } = req;
        const { productId, quantity, reason, notes } = req.body;

        if (!productId || !quantity) {
            throw createHttpError(400, "Product ID and quantity are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Inventory, InventoryTransaction, Product } = models;
            
            const inventory = await Inventory.findOne({
                where: { businessId, ...(outletId && { outletId }), productId },
                include: [{ model: Product, as: 'product' }],
                transaction
            });

            if (!inventory || Number(inventory.quantity || 0) < quantity) {
                throw createHttpError(400, `Insufficient stock. Available: ${inventory?.quantity || 0}`);
            }

            const oldQty = Number(inventory.quantity || 0);
            const newQty = oldQty - parseInt(quantity);

            await inventory.update({ quantity: newQty }, { transaction });

            const invTransaction = await InventoryTransaction.create({
                businessId,
                outletId,
                inventoryId: inventory.id,
                productId,
                type: 'WASTAGE',
                quantity: parseInt(quantity),
                unitCost: inventory.unitCost,
                totalCost: (inventory.unitCost || 0) * parseInt(quantity),
                previousQuantity: oldQty,
                newQuantity: newQty,
                notes: notes || `Wastage: ${reason || 'Not specified'}`,
                performedBy: req.auth?.id
            }, { transaction });

            return { inventory, transaction: invTransaction };
        });

        console.log('[INVENTORY CONTROLLER] addWastage result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData, message: "Wastage recorded" });
    } catch (error) {
        next(error);
    }
};

/**
 * Get wastage records
 */
exports.getWastage = async (req, res, next) => {
    enforceOutletScope(req);
    try {
        const { businessId } = req;
        const { startDate, endDate, productId } = req.query;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { InventoryTransaction, Product } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { type: 'WASTAGE' });
            
            if (productId) whereClause.productId = productId;
            if (startDate && endDate) {
                whereClause.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
            }

            return await InventoryTransaction.findAll({
                where: whereClause,
                include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'sku'] }],
                order: [['createdAt', 'DESC']]
            });
        });

        console.log('[INVENTORY CONTROLLER] getTransactions result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData });
    } catch (error) {
        next(error);
    }
};

/**
 * Adjust stock
 */
exports.adjustStock = async (req, res, next) => {
    enforceOutletScope(req);
    try {
        const { businessId, outletId } = req;
        const { productId, newQuantity, reason } = req.body;

        if (!productId || newQuantity === undefined) {
            throw createHttpError(400, "Product ID and new quantity are required");
        }

        if (!outletId) {
            throw createHttpError(400, "Outlet ID is required to adjust stock");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Inventory, InventoryTransaction, Product } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { productId });
            
            let [inventory] = await Inventory.findOrCreate({
                where: whereClause,
                defaults: { quantity: 0, unitCost: 0, businessId },
                transaction
            });

            const oldQty = Number(inventory.quantity || 0);
            const targetQty = parseInt(newQuantity);
            const adjustment = targetQty - oldQty;

            await inventory.update({ quantity: targetQty }, { transaction });

            const invTransaction = await InventoryTransaction.create({
                businessId,
                outletId,
                inventoryId: inventory.id,
                productId,
                type: adjustment >= 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
                quantity: Math.abs(adjustment),
                unitCost: inventory.unitCost || 0,
                previousQuantity: oldQty,
                newQuantity: targetQty,
                notes: reason || 'Stock adjustment',
                performedBy: req.auth?.id
            }, { transaction });

            return { inventory, transaction: invTransaction, adjustment };
        });

        console.log('[INVENTORY CONTROLLER] adjustStock result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData, message: "Stock adjusted" });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all inventory transactions
 */
exports.getTransactions = async (req, res, next) => {
    enforceOutletScope(req);
    try {
        const { businessId } = req;
        const { productId, type, startDate, endDate } = req.query;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { InventoryTransaction, Product } = models;
            
            const { whereClause } = buildStrictWhereClause(req);
            
            if (productId) whereClause.productId = productId;
            if (type) whereClause.type = type;
            if (startDate && endDate) {
                whereClause.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
            }

            return await InventoryTransaction.findAll({
                where: whereClause,
                include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'sku'] }],
                order: [['createdAt', 'DESC']]
            });
        });

        console.log('[INVENTORY CONTROLLER] getTransactions result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData });
    } catch (error) {
        next(error);
    }
};

/**
 * Update transaction
 */
exports.updateTransaction = async (req, res, next) => {
    enforceOutletScope(req);
    try {
        const { id } = req.params;
        const { businessId } = req;
        const updateData = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { InventoryTransaction } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { id });

            const tx = await InventoryTransaction.findOne({
                where: whereClause,
                transaction
            });
            if (!tx) throw createHttpError(404, "Transaction not found");

            await tx.update(updateData, { transaction });
            return tx;
        });

        console.log('[INVENTORY CONTROLLER] updateTransaction result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData, message: "Transaction updated" });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete transaction
 */
exports.deleteTransaction = async (req, res, next) => {
    enforceOutletScope(req);
    try {
        const { id } = req.params;
        const { businessId } = req;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { InventoryTransaction } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { id });

            const tx = await InventoryTransaction.findOne({
                where: whereClause,
                transaction
            });
            if (!tx) throw createHttpError(404, "Transaction not found");

            await tx.destroy({ transaction });
        });

        res.json({ success: true, message: "Transaction deleted" });
    } catch (error) {
        next(error);
    }
};

/**
 * Get low stock items
 */
exports.getLowStock = async (req, res, next) => {
    enforceOutletScope(req);
    try {
        const { businessId } = req;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Inventory, Product } = models;
            
            const { whereClause } = buildStrictWhereClause(req);

            const items = await Inventory.findAll({
                where: whereClause,
                include: [{ model: Product, as: 'product' }]
            });

            return items.filter(item => 
                Number(item.quantity || 0) <= (item.reorderLevel || item.product?.reorderLevel || 10)
            );
        });

        console.log('[INVENTORY CONTROLLER] getTransactions result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData });
    } catch (error) {
        next(error);
    }
};

// ==================== ALIASES & COMPATIBILITY ====================

exports.addStock = exports.addPurchase;
exports.getInventory = exports.getItems;
exports.getInventoryItems = exports.getItems;
exports.addInventoryItem = exports.addItem;
exports.updateInventoryItem = exports.updateItem;
exports.deleteInventoryItem = exports.deleteItem;
