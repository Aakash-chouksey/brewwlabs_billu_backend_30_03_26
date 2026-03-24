/**
 * INVENTORY SERVICE - Neon-Safe Transaction Pattern
 * 
 * Service functions for inventory operations that work with models passed from controllers
 */

const { Op } = require("sequelize");

/**
 * Check if product can be prepared with current inventory
 */
exports.canPrepareProduct = async (models, productId, quantity, businessId, outletId) => {
    const { Inventory, Product, Recipe, RecipeIngredient } = models;
    
    // Check if product has a recipe
    const recipe = await Recipe.findOne({
        where: { productId },
        include: [{
            model: RecipeIngredient,
            include: [{ model: Inventory, where: { businessId, outletId } }]
        }]
    });

    if (!recipe) {
        // No recipe, check direct inventory
        const inventory = await Inventory.findOne({
            where: { productId, businessId, outletId },
            include: [{ model: Product, as: 'product' }]
        });

        return {
            canPrepare: inventory && inventory.quantity >= quantity,
            productId,
            requiredQuantity: quantity,
            availableQuantity: inventory?.quantity || 0,
            shortage: Math.max(0, quantity - (inventory?.quantity || 0)),
            ingredients: []
        };
    }

    // Check recipe ingredients
    const ingredients = recipe.RecipeIngredients || [];
    const availability = [];
    let canPrepare = true;

    for (const ing of ingredients) {
        const inventory = ing.Inventory;
        const requiredQty = ing.quantity * quantity;
        const availableQty = inventory?.quantity || 0;
        const hasEnough = availableQty >= requiredQty;

        if (!hasEnough) canPrepare = false;

        availability.push({
            inventoryId: ing.inventoryId,
            name: inventory?.Product?.name || 'Unknown',
            required: requiredQty,
            available: availableQty,
            hasEnough,
            shortage: Math.max(0, requiredQty - availableQty)
        });
    }

    return {
        canPrepare,
        productId,
        requiredQuantity: quantity,
        availableQuantity: availability.filter(a => a.hasEnough).length,
        shortage: availability.filter(a => !a.hasEnough).length,
        ingredients: availability
    };
};

/**
 * Check order availability for multiple products
 */
exports.checkOrderAvailability = async (models, orderItems, businessId, outletId) => {
    const results = [];
    let allAvailable = true;

    for (const item of orderItems) {
        const result = await exports.canPrepareProduct(
            models,
            item.productId,
            item.quantity,
            businessId,
            outletId
        );
        results.push(result);
        if (!result.canPrepare) allAvailable = false;
    }

    return {
        allAvailable,
        items: results,
        totalItems: orderItems.length,
        availableItems: results.filter(r => r.canPrepare).length
    };
};

/**
 * Deduct inventory for single product sale
 */
exports.deductInventoryForSale = async (models, productId, quantity, orderId, businessId, outletId, userId) => {
    const { Inventory, InventoryTransaction, Product, Recipe, RecipeIngredient } = models;

    const recipe = await Recipe.findOne({
        where: { productId },
        include: [{
            model: RecipeIngredient,
            include: [{ model: Inventory, where: { businessId, outletId } }]
        }]
    });

    const deductions = [];

    if (recipe && recipe.RecipeIngredients) {
        // Deduct recipe ingredients
        for (const ing of recipe.RecipeIngredients) {
            const inventory = ing.Inventory;
            if (!inventory) continue;

            const deductQty = ing.quantity * quantity;
            const oldQty = inventory.quantity;
            const newQty = oldQty - deductQty;

            await inventory.update({ quantity: newQty });

            const tx = await InventoryTransaction.create({
                businessId,
                outletId,
                inventoryId: inventory.id,
                productId: ing.productId,
                type: 'SALE',
                quantity: deductQty,
                unitCost: inventory.unitCost,
                totalCost: inventory.unitCost * deductQty,
                previousQuantity: oldQty,
                newQuantity: newQty,
                referenceType: 'ORDER',
                referenceId: orderId,
                notes: `Sale: Product ${productId}`,
                performedBy: userId
            });

            deductions.push({ inventoryId: inventory.id, quantity: deductQty, transaction: tx });
        }
    } else {
        // Deduct from direct inventory
        const inventory = await Inventory.findOne({
            where: { productId, businessId, outletId },
            include: [{ model: Product, as: 'product' }]
        });

        if (inventory) {
            const oldQty = inventory.quantity;
            const newQty = oldQty - quantity;

            await inventory.update({ quantity: newQty });

            const tx = await InventoryTransaction.create({
                businessId,
                outletId,
                inventoryId: inventory.id,
                productId,
                type: 'SALE',
                quantity,
                unitCost: inventory.unitCost,
                totalCost: inventory.unitCost * quantity,
                previousQuantity: oldQty,
                newQuantity: newQty,
                referenceType: 'ORDER',
                referenceId: orderId,
                notes: 'Direct sale',
                performedBy: userId
            });

            deductions.push({ inventoryId: inventory.id, quantity, transaction: tx });
        }
    }

    return {
        productId,
        quantity,
        orderId,
        deductions,
        success: deductions.length > 0
    };
};

/**
 * Deduct inventory for order with multiple items
 */
exports.deductInventoryForOrder = async (models, orderItems, orderId, businessId, outletId, userId) => {
    const results = [];

    for (const item of orderItems) {
        const result = await exports.deductInventoryForSale(
            models,
            item.productId,
            item.quantity,
            orderId,
            businessId,
            outletId,
            userId
        );
        results.push(result);
    }

    return {
        orderId,
        items: results,
        totalDeductions: results.reduce((sum, r) => sum + r.deductions.length, 0),
        success: results.every(r => r.success)
    };
};

/**
 * Get consumption report
 */
exports.getConsumptionReport = async (models, businessId, outletId, startDate, endDate) => {
    const { InventoryTransaction, Product } = models;

    const whereClause = {
        businessId,
        type: { [Op.in]: ['SALE', 'SELF_CONSUME', 'WASTAGE', 'TRANSFER_OUT'] }
    };
    if (outletId) whereClause.outletId = outletId;
    if (startDate && endDate) {
        whereClause.createdAt = {
            [Op.between]: [new Date(startDate), new Date(endDate)]
        };
    }

    const transactions = await InventoryTransaction.findAll({
        where: whereClause,
        include: [{ model: Product, attributes: ['id', 'name', 'sku'] }],
        order: [['createdAt', 'DESC']]
    });

    // Aggregate by product
    const consumption = {};
    transactions.forEach(tx => {
        const pid = tx.productId;
        if (!consumption[pid]) {
            consumption[pid] = {
                productId: pid,
                name: tx.Product?.name || 'Unknown',
                sku: tx.Product?.sku || '',
                totalQuantity: 0,
                totalValue: 0,
                byType: {}
            };
        }
        consumption[pid].totalQuantity += tx.quantity;
        consumption[pid].totalValue += tx.totalCost;

        if (!consumption[pid].byType[tx.type]) {
            consumption[pid].byType[tx.type] = { quantity: 0, value: 0 };
        }
        consumption[pid].byType[tx.type].quantity += tx.quantity;
        consumption[pid].byType[tx.type].value += tx.totalCost;
    });

    return {
        success: true,
        data: Object.values(consumption),
        totalTransactions: transactions.length,
        period: { startDate, endDate }
    };
};

/**
 * Get low stock alerts
 */
exports.getLowStockAlerts = async (models, businessId, outletId) => {
    const { Inventory, Product } = models;

    const whereClause = { businessId };
    if (outletId) whereClause.outletId = outletId;

    const inventory = await Inventory.findAll({
        where: whereClause,
        include: [{ model: Product }]
    });

    const alerts = inventory
        .filter(item => {
            const threshold = item.reorderLevel || item.Product?.reorderLevel || 10;
            return item.quantity <= threshold;
        })
        .map(item => ({
            inventoryId: item.id,
            productId: item.productId,
            name: item.Product?.name || 'Unknown',
            currentQuantity: item.quantity,
            reorderLevel: item.reorderLevel || item.Product?.reorderLevel || 10,
            shortage: (item.reorderLevel || item.Product?.reorderLevel || 10) - item.quantity,
            outletId: item.outletId
        }));

    return {
        success: true,
        data: alerts,
        totalAlerts: alerts.length
    };
};

/**
 * Get inventory value report
 */
exports.getInventoryValueReport = async (models, businessId, outletId) => {
    const { Inventory, Product, Category } = models;

    const whereClause = { businessId };
    if (outletId) whereClause.outletId = outletId;

    const inventory = await Inventory.findAll({
        where: whereClause,
        include: [{ model: Product, include: [{ model: Category, as: 'category' }] }]
    });

    let totalValue = 0;
    let totalItems = 0;
    const byCategory = {};

    inventory.forEach(item => {
        const value = item.quantity * (item.unitCost || 0);
        totalValue += value;
        totalItems += item.quantity;

        const catName = item.Product?.Category?.name || 'Uncategorized';
        if (!byCategory[catName]) {
            byCategory[catName] = { category: catName, items: 0, value: 0, quantity: 0 };
        }
        byCategory[catName].items++;
        byCategory[catName].value += value;
        byCategory[catName].quantity += item.quantity;
    });

    return {
        success: true,
        summary: {
            totalValue: Math.round(totalValue * 100) / 100,
            totalItems,
            uniqueProducts: inventory.length
        },
        byCategory: Object.values(byCategory),
        details: inventory.map(item => ({
            inventoryId: item.id,
            productId: item.productId,
            name: item.Product?.name || 'Unknown',
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalValue: Math.round(item.quantity * item.unitCost * 100) / 100
        }))
    };
};
