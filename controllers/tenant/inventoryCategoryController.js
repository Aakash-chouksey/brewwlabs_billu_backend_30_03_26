const createHttpError = require("http-errors");
const { enforceOutletScope, buildStrictWhereClause } = require("../../utils/outletGuard");

/**
 * Get all inventory categories
 */
exports.getCategories = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const business_id = req.business_id || req.businessId;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { InventoryCategory } = models;
            
            const { whereClause } = buildStrictWhereClause(req);
            
            return await InventoryCategory.findAll({
                where: whereClause,
                order: [['name', 'ASC']]
            });
        });

        const responseData = result.data || result || [];
        res.json({ 
            success: true, 
            data: responseData,
            message: "Inventory categories retrieved successfully"
        });
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
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;
        const { name, description, color } = req.body;

        if (!name) {
            throw createHttpError(400, "Category name is required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { InventoryCategory } = models;
            
            return await InventoryCategory.create({
                businessId: business_id,
                outletId: outlet_id,
                name,
                description,
                color: color || '#000000'
            }, { transaction });
        });

        const responseData = result.data || result;
        res.status(201).json({ 
            success: true, 
            data: responseData, 
            message: "Inventory category created successfully" 
        });
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
        const business_id = req.business_id || req.businessId;
        const updateData = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { InventoryCategory } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { id });

            const category = await InventoryCategory.findOne({
                where: whereClause,
                transaction
            });
            if (!category) throw createHttpError(404, "Category not found");

            await category.update(updateData, { transaction });
            return category;
        });

        const responseData = result.data || result;
        res.json({ 
            success: true, 
            data: responseData, 
            message: "Inventory category updated successfully" 
        });
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
        const business_id = req.business_id || req.businessId;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { InventoryCategory, InventoryItem } = models;
            
            const { whereClause } = buildStrictWhereClause(req, { id });

            // Check if category has inventory items
            const items = await InventoryItem.count({
                where: { inventoryCategoryId: id },
                transaction
            });
            
            if (items > 0) {
                throw createHttpError(400, `Cannot delete category with ${items} inventory items`);
            }

            const category = await InventoryCategory.findOne({ where: whereClause, transaction });
            if (!category) throw createHttpError(404, "Category not found");

            await category.destroy({ transaction });
        });

        res.json({ 
            success: true, 
            message: "Inventory category deleted successfully" 
        });
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

            const category = await InventoryCategory.findOne({ where: whereClause, transaction });
            if (!category) throw createHttpError(404, "Category not found");

            const newStatus = !category.isActive;
            await category.update({ isActive: newStatus }, { transaction });
            return { category, newStatus };
        });

        const responseData = (result.category?.data || result.category) || result;
        res.json({ 
            success: true, 
            data: responseData, 
            message: `Category ${result.newStatus ? 'activated' : 'deactivated'} successfully` 
        });
    } catch (error) {
        next(error);
    }
};
