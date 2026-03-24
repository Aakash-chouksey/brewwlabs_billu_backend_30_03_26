const createHttpError = require("http-errors");
const { enforceOutletScope, buildStrictWhereClause } = require("../utils/outletGuard");
const { safeQuery } = require("../utils/safeQuery");

/**
 * Get all inventory categories
 */
exports.getCategories = async (req, res, next) => {
    try {
        enforceOutletScope(req);

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { InventoryCategory } = models;
            
            const { whereClause } = buildStrictWhereClause(req);
            
            return await safeQuery(
                () => InventoryCategory.findAll({
                    where: whereClause,
                    order: [['name', 'ASC']]
                }),
                []
            );
        });

        console.log('[INV CATEGORY CONTROLLER] getCategories result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData || [] });
    } catch (error) {
        next(error);
    }
};

/**
 * Add new inventory category
 */
exports.addCategory = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { businessId, outletId } = req;
        const { name, description, color } = req.body;

        if (!name) {
            throw createHttpError(400, "Category name is required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { InventoryCategory } = models;
            
            return await InventoryCategory.create({
                businessId,
                outletId,
                name,
                description,
                color: color || '#000000'
            }, { transaction });
        });

        console.log('[INV CATEGORY CONTROLLER] addCategory result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.status(201).json({ success: true, data: responseData, message: "Category created" });
    } catch (error) {
        next(error);
    }
};

/**
 * Update inventory category
 */
exports.updateCategory = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { id } = req.params;
        const { businessId } = req;
        const updateData = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { InventoryCategory } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { id });

            const category = await safeQuery(
                () => InventoryCategory.findOne({
                    where: whereClause,
                    transaction
                }),
                null
            );
            if (!category) throw createHttpError(404, "Category not found");

            await category.update(updateData, { transaction });
            return category;
        });

        console.log('[INV CATEGORY CONTROLLER] updateCategory result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData, message: "Category updated" });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete inventory category
 */
exports.deleteCategory = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { id } = req.params;
        const { businessId } = req;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { InventoryCategory, InventoryItem } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { id });

            // Check if category has inventory items (use InventoryItem as it's the more reliable model)
            const items = await safeQuery(
                () => InventoryItem.count({
                    where: { inventoryCategoryId: id },
                    transaction
                }),
                0
            );
            
            if (items > 0) {
                throw createHttpError(400, `Cannot delete category with ${items} inventory items`);
            }

            const category = await safeQuery(
                () => InventoryCategory.findOne({
                    where: whereClause,
                    transaction
                }),
                null
            );
            if (!category) throw createHttpError(404, "Category not found");

            await category.destroy({ transaction });
        });

        res.json({ success: true, message: "Category deleted" });
    } catch (error) {
        next(error);
    }
};

/**
 * Toggle category status
 */
exports.toggleStatus = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { id } = req.params;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { InventoryCategory } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { id });

            const category = await safeQuery(
                () => InventoryCategory.findOne({
                    where: whereClause,
                    transaction
                }),
                null
            );
            if (!category) throw createHttpError(404, "Category not found");

            const newStatus = !category.isActive;
            await category.update({ isActive: newStatus }, { transaction });
            return { category, newStatus };
        });

        console.log('[INV CATEGORY CONTROLLER] toggleStatus result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = (result.category?.data || result.category) || result;
        res.json({ success: true, data: responseData, message: `Category ${result.newStatus ? 'activated' : 'deactivated'}` });
    } catch (error) {
        next(error);
    }
};
