const createHttpError = require("http-errors");
const { enforceOutletScope, buildStrictWhereClause } = require("../utils/outletGuard");
const { Op } = require("sequelize");

// ==================== RAW MATERIALS (InventoryItem) ====================

/**
 * Get all raw materials
 */
exports.getRawMaterials = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { businessId, outletId } = req;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { InventoryItem, InventoryCategory, Supplier } = models;
            
            const { whereClause } = buildStrictWhereClause(req);
            
            return await InventoryItem.findAll({
                where: whereClause,
                include: [
                    { model: InventoryCategory, as: 'category', attributes: ['id', 'name'] },
                    { model: Supplier, as: 'supplier', attributes: ['id', 'name'] }
                ],
                order: [['created_at', 'DESC']]
            });
        });

        const responseData = result.data || result;
        res.json({ success: true, data: responseData || [] });
    } catch (error) {
        next(error);
    }
};

/**
 * Add new raw material
 */
exports.addRawMaterial = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { businessId, outletId } = req;
        const { name, inventoryCategoryId, unit, sku, currentStock, minimumStock, costPerUnit, supplierId, supplierName } = req.body;

        if (!name || !inventoryCategoryId) {
            throw createHttpError(400, "Name and category are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { InventoryItem, InventoryTransaction } = models;
            
            const newItem = await InventoryItem.create({
                businessId,
                outletId,
                name,
                inventoryCategoryId,
                unit: unit || 'piece',
                sku,
                currentStock: currentStock || 0,
                minimumStock: minimumStock || 5,
                costPerUnit: costPerUnit || 0,
                supplierId,
                supplierName
            }, { transaction });

            // Create initial transaction if stock is provided
            if (Number(currentStock) > 0) {
                await InventoryTransaction.create({
                    businessId,
                    outletId,
                    inventoryItemId: newItem.id,
                    type: 'INITIAL_STOCK',
                    quantity: Number(currentStock),
                    unitCost: Number(costPerUnit) || 0,
                    totalCost: Number(currentStock) * (Number(costPerUnit) || 0),
                    previousQuantity: 0,
                    newQuantity: Number(currentStock),
                    notes: 'Initial stock on creation',
                    performedBy: req.auth?.id
                }, { transaction });
            }

            return newItem;
        });

        const responseData = result.data || result;
        res.status(201).json({ success: true, data: responseData, message: "Raw material created" });
    } catch (error) {
        next(error);
    }
};

/**
 * Update raw material
 */
exports.updateRawMaterial = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { id } = req.params;
        const { businessId } = req;
        const updateData = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { InventoryItem } = models;
            
            const item = await InventoryItem.findOne({
                where: { id, businessId },
                transaction
            });
            if (!item) throw createHttpError(404, "Raw material not found");

            await item.update(updateData, { transaction });
            return item;
        });

        const responseData = result.data || result;
        res.json({ success: true, data: responseData, message: "Raw material updated" });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete raw material
 */
exports.deleteRawMaterial = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { id } = req.params;
        const { businessId } = req;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { InventoryItem, InventoryTransaction } = models;
            
            const item = await InventoryItem.findOne({
                where: { id, businessId },
                transaction
            });
            if (!item) throw createHttpError(404, "Raw material not found");

            // Delete transactions first
            await InventoryTransaction.destroy({
                where: { inventoryItemId: id },
                transaction
            });

            await item.destroy({ transaction });
        });

        res.json({ success: true, message: "Raw material deleted" });
    } catch (error) {
        next(error);
    }
};

// ==================== PRODUCT STOCK (Inventory - Linked to Product) ====================

/**
 * Get all inventory items
 */
exports.getItems = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { businessId, outletId } = req;
        const startTime = Date.now();
        
        console.log(`[INVENTORY getItems] START - businessId: ${businessId}, outletId: ${outletId}`);

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models, sequelize } = context;
            const { Inventory, Product } = models;
            
            console.log(`[INVENTORY getItems] Models loaded in ${Date.now() - startTime}ms`);
            
            const { whereClause } = buildStrictWhereClause(req);
            console.log(`[INVENTORY getItems] whereClause:`, JSON.stringify(whereClause));
            
            const queryStartTime = Date.now();
            
            const items = await Inventory.findAll({
                where: whereClause,
                include: [{ 
                    model: Product, 
                    as: 'product',
                    attributes: ['id', 'name', 'sku', 'price', 'currentStock', 'isActive']
                }],
                attributes: {
                    include: [
                        [sequelize.literal('quantity <= reorder_level'), 'is_low_stock']
                    ]
                },
                order: [['updated_at', 'DESC']],
                limit: 1000 // Safety limit for performance
            });
            
            const queryTime = Date.now() - queryStartTime;
            console.log(`[INVENTORY getItems] Query executed in ${queryTime}ms, returned ${items.length} items`);

            return items;
        });

        const totalTime = Date.now() - startTime;
        console.log(`[INVENTORY getItems] SUCCESS - Total time: ${totalTime}ms`);
        
        const responseData = result.data || result;
        res.json({ 
            success: true, 
            data: responseData || [],
            meta: {
                executionTimeMs: totalTime,
                count: responseData?.length || 0
            }
        });
    } catch (error) {
        console.error(`[INVENTORY getItems] ERROR:`, error.message);
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
            
            const product = await Product.findOne({
                where: { id: productId, businessId },
                transaction
            });
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

            return await InventoryTransaction.findAll({
                where: whereClause,
                order: [['created_at', 'DESC']],
                limit: 50
            });
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

        console.log('[INVENTORY CONTROLLER] syncProducts result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData, message: "Inventory sync complete" });
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
                order: [['created_at', 'DESC']]
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
                order: [['created_at', 'DESC']]
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
    const startTime = Date.now();
    
    try {
        const { businessId } = req;
        
        console.log(`[INVENTORY getLowStock] START - businessId: ${businessId}, outletId: ${req.outletId}`);

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models, sequelize } = context;
            const { Inventory, Product } = models;
            
            console.log(`[INVENTORY getLowStock] Models loaded:`, Object.keys(models));
            
            const { whereClause } = buildStrictWhereClause(req);
            console.log(`[INVENTORY getLowStock] whereClause:`, JSON.stringify(whereClause));

            // Use database-level filtering for performance
            const items = await Inventory.findAll({
                where: {
                    ...whereClause,
                    quantity: { [Op.lte]: sequelize.col('reorder_level') }
                },
                include: [{ 
                    model: Product, 
                    as: 'product',
                    attributes: ['id', 'name', 'sku', 'currentStock']
                }],
                order: [['quantity', 'ASC']]
            });
            
            console.log(`[INVENTORY getLowStock] Query executed, found ${items.length} items`);

            // Additional client-side filter for safety (handles edge cases)
            const lowStockItems = items.filter(item => 
                Number(item.quantity || 0) <= Number(item.reorderLevel || 10)
            );
            
            console.log(`[INVENTORY getLowStock] Filtered to ${lowStockItems.length} low-stock items`);
            
            return lowStockItems;
        });

        const executionTime = Date.now() - startTime;
        console.log(`[INVENTORY getLowStock] SUCCESS - ${result.length} items in ${executionTime}ms`);
        
        const responseData = result.data || result;
        res.json({ 
            success: true, 
            data: responseData,
            meta: {
                executionTimeMs: executionTime,
                count: responseData.length
            }
        });
    } catch (error) {
        const executionTime = Date.now() - startTime;
        console.error(`[INVENTORY getLowStock] ERROR after ${executionTime}ms:`, error.message);
        console.error(`[INVENTORY getLowStock] Stack:`, error.stack);
        next(error);
    }
};

// ==================== ALIASES & COMPATIBILITY ====================

// Legacy compatibility & Route mapping
exports.getInventoryItems = exports.getItems; // Standardized: Product Stock
exports.addInventoryItem = exports.addItem;
exports.updateInventoryItem = exports.updateItem;
exports.deleteInventoryItem = exports.deleteItem;

// Raw Materials (InventoryItem) aliases
exports.getInventoryRawMaterials = exports.getRawMaterials;
exports.addInventoryRawMaterial = exports.addRawMaterial;
