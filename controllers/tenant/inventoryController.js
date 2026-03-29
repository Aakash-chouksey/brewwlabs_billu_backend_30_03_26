const createHttpError = require("http-errors");
const { enforceOutletScope, buildStrictWhereClause } = require("../../utils/outletGuard");
const { Op } = require("sequelize");

// ==================== RAW MATERIALS (InventoryItem) ====================

/**
 * Get all raw materials
 */
exports.getRawMaterials = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const business_id = req.business_id || req.businessId;

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

        const responseData = result.data || result || [];
        res.json({ 
            success: true, 
            data: responseData,
            message: "Raw materials retrieved successfully"
        });
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
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;
        const { name, inventoryCategoryId, unit, sku, currentStock, minimumStock, costPerUnit, supplierId, supplierName } = req.body;

        if (!name || !inventoryCategoryId) {
            throw createHttpError(400, "Name and category are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { InventoryItem, InventoryTransaction } = models;
            
            const newItem = await InventoryItem.create({
                businessId: business_id,
                outletId: outlet_id,
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

            if (!newItem) throw createHttpError(500, "Inventory item creation failed");

            // Create initial transaction if stock is provided
            if (Number(currentStock) > 0) {
                try {
                    await InventoryTransaction.create({
                        businessId: business_id,
                        outletId: outlet_id,
                        inventoryItemId: newItem.id,
                        type: 'INITIAL_STOCK',
                        quantity: Number(currentStock),
                        unitCost: Number(costPerUnit) || 0,
                        totalCost: Number(currentStock) * (Number(costPerUnit) || 0),
                        previousQuantity: 0,
                        newQuantity: Number(currentStock),
                        notes: 'Initial stock on creation',
                        performedBy: req.user?.id
                    }, { transaction });
                } catch (txError) {
                    console.error(`[InventoryController] ❌ Transaction failed for ${newItem.id}:`, txError.message);
                    throw txError;
                }
            }

            return newItem;
        });

        const responseData = result.data || result;
        res.status(201).json({ 
            success: true, 
            data: responseData, 
            message: "Raw material created successfully" 
        });
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
        const business_id = req.business_id || req.businessId;
        const updateData = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { InventoryItem } = models;
            
            const item = await InventoryItem.findOne({
                where: { id, businessId: business_id },
                transaction
            });
            if (!item) throw createHttpError(404, "Raw material not found");

            await item.update(updateData, { transaction });
            return item;
        });

        const responseData = result.data || result;
        res.json({ 
            success: true, 
            data: responseData, 
            message: "Raw material updated successfully" 
        });
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
        const business_id = req.business_id || req.businessId;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { InventoryItem, InventoryTransaction } = models;
            
            const item = await InventoryItem.findOne({
                where: { id, businessId: business_id },
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

        res.json({ 
            success: true, 
            message: "Raw material deleted successfully" 
        });
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
        const business_id = req.business_id || req.businessId;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models, sequelize } = context;
            const { Inventory, Product } = models;
            
            const { whereClause } = buildStrictWhereClause(req);
            
            const items = await Inventory.findAll({
                where: whereClause,
                include: [{ 
                    model: Product, 
                    as: 'product',
                    attributes: ['id', 'name', 'sku', 'price', 'isActive']
                }],
                attributes: {
                    include: [
                        [sequelize.literal('quantity <= reorder_level'), 'is_low_stock']
                    ]
                },
                order: [['updated_at', 'DESC']],
                limit: 1000
            });
            
            return items;
        });

        const responseData = result.data || result || [];
        res.json({ 
            success: true, 
            data: responseData,
            message: "Inventory items retrieved successfully"
        });
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
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;
        const { productId, adjustment, unitCost, reason, location } = req.body;

        if (!productId || adjustment === undefined) {
            throw createHttpError(400, "Product ID and adjustment are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Inventory, InventoryTransaction, Product } = models;
            
            const product = await Product.findOne({
                where: { id: productId, businessId: business_id },
                transaction
            });
            if (!product) throw createHttpError(404, "Product not found");

            let [inventory] = await Inventory.findOrCreate({
                where: { businessId: business_id, outletId: outlet_id, productId },
                defaults: { 
                    businessId: business_id,
                    outletId: outlet_id,
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
                businessId: business_id,
                outletId: outlet_id,
                inventoryId: inventory.id,
                productId,
                type: adjustment >= 0 ? 'STOCK_IN' : 'STOCK_OUT',
                quantity: Math.abs(adjustment),
                unitCost: unitCost || inventory.unitCost,
                totalCost: Math.abs(adjustment) * (unitCost || inventory.unitCost),
                previousQuantity: prevQty,
                newQuantity: newQty,
                performedBy: req.user?.id,
                reason,
                reference: 'MANUAL_ADJUSTMENT'
            }, { transaction });

            return inventory;
        });

        const responseData = result.data || result;
        res.json({ 
            success: true, 
            data: responseData, 
            message: "Stock adjusted successfully" 
        });
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

        const responseData = result.data || result || [];
        res.json({ 
            success: true, 
            data: responseData,
            message: "Inventory transactions retrieved successfully"
        });
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
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Product, Inventory } = models;
            
            const products = await Product.findAll({
                where: { businessId: business_id, outletId: outlet_id },
                transaction
            });

            const productIds = products.map(p => p.id);
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

            const inventoryRecordsToCreate = [];
            for (const product of products) {
                if (!inventoryMap[product.id]) {
                    inventoryRecordsToCreate.push({
                        businessId: business_id,
                        outletId: outlet_id,
                        productId: product.id,
                        quantity: 0,
                        unitCost: 0
                    });
                }
            }

            if (inventoryRecordsToCreate.length > 0) {
                await Inventory.bulkCreate(inventoryRecordsToCreate, { transaction });
            }

            return { 
                syncedCount: products.length, 
                createdCount: inventoryRecordsToCreate.length,
                existingCount: products.length - inventoryRecordsToCreate.length
            };
        });

        const responseData = result.data || result;
        res.json({ 
            success: true, 
            data: responseData, 
            message: "Inventory sync completed successfully" 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Add new inventory item
 */
exports.addItem = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;
        const { productId, quantity, unitCost, type, notes, location } = req.body;

        if (!productId || !quantity) {
            throw createHttpError(400, "Product ID and quantity are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Inventory, InventoryTransaction, Product } = models;
            
            const product = await Product.findOne({
                where: { id: productId, businessId: business_id },
                transaction
            });
            if (!product) throw createHttpError(404, "Product not found");

            let [inventory, created] = await Inventory.findOrCreate({
                where: { businessId: business_id, outletId: outlet_id, productId },
                defaults: { 
                    businessId: business_id,
                    outletId: outlet_id,
                    productId,
                    quantity: 0, 
                    unitCost: unitCost || 0, 
                    location 
                },
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

            const invTransaction = await InventoryTransaction.create({
                businessId: business_id,
                outletId: outlet_id,
                inventoryId: inventory.id,
                productId,
                type: type || 'PURCHASE',
                quantity: parseInt(quantity),
                unitCost: unitCost || inventory.unitCost,
                totalCost: (unitCost || inventory.unitCost) * parseInt(quantity),
                previousQuantity: oldQty,
                newQuantity: newQty,
                notes: notes || 'Stock added',
                performedBy: req.user?.id
            }, { transaction });

            return { inventory, transaction: invTransaction, isNew: created };
        });

        const responseData = result.data || result;
        res.status(201).json({ 
            success: true, 
            data: responseData,
            message: responseData.isNew ? "Inventory created successfully" : "Inventory updated successfully"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update inventory item
 */
exports.updateItem = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { id } = req.params;
        const business_id = req.business_id || req.businessId;
        const updateData = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Inventory } = models;
            
            const inventory = await Inventory.findOne({
                where: { id, businessId: business_id },
                transaction
            });
            if (!inventory) throw createHttpError(404, "Inventory item not found");

            await inventory.update(updateData, { transaction });
            return inventory;
        });

        const responseData = result.data || result;
        res.json({ 
            success: true, 
            data: responseData, 
            message: "Inventory item updated successfully" 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete inventory item
 */
exports.deleteItem = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { id } = req.params;
        const business_id = req.business_id || req.businessId;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Inventory, InventoryTransaction } = models;
            
            const inventory = await Inventory.findOne({
                where: { id, businessId: business_id },
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

        res.json({ 
            success: true, 
            message: "Inventory item deleted successfully" 
        });
    } catch (error) {
        next(error);
    }
};

// Aliases for route compatibility
exports.getInventoryItems = exports.getRawMaterials;
exports.addInventoryItem = exports.addRawMaterial;
exports.updateInventoryItem = exports.updateRawMaterial;
exports.deleteInventoryItem = exports.deleteRawMaterial;
