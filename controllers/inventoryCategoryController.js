/**
 * INVENTORY CATEGORY CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");

/**
 * Get all inventory categories
 */
exports.getCategories = async (req, res, next) => {
    try {
        const { businessId } = req;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { InventoryCategory } = models;
            
            return await InventoryCategory.findAll({
                where: { businessId },
                order: [['name', 'ASC']]
            });
        });

        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

/**
 * Add new inventory category
 */
exports.addCategory = async (req, res, next) => {
    try {
        const { businessId } = req;
        const { name, description, color } = req.body;

        if (!name) {
            throw createHttpError(400, "Category name is required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { InventoryCategory } = models;
            
            return await InventoryCategory.create({
                businessId,
                name,
                description,
                color: color || '#000000'
            }, { transaction });
        });

        res.status(201).json({ success: true, data: result, message: "Category created" });
    } catch (error) {
        next(error);
    }
};

/**
 * Update inventory category
 */
exports.updateCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { businessId } = req;
        const updateData = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { InventoryCategory } = models;
            
            const category = await InventoryCategory.findOne({
                where: { id, businessId },
                transaction
            });
            if (!category) throw createHttpError(404, "Category not found");

            await category.update(updateData, { transaction });
            return category;
        });

        res.json({ success: true, data: result, message: "Category updated" });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete inventory category
 */
exports.deleteCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { businessId } = req;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { InventoryCategory, Inventory } = models;
            
            // Check if category has inventory items
            const items = await Inventory.count({
                where: { categoryId: id },
                transaction
            });
            
            if (items > 0) {
                throw createHttpError(400, `Cannot delete category with ${items} inventory items`);
            }

            const category = await InventoryCategory.findOne({
                where: { id, businessId },
                transaction
            });
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
        const { id } = req.params;
        const { businessId } = req;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { InventoryCategory } = models;
            
            const category = await InventoryCategory.findOne({
                where: { id, businessId },
                transaction
            });
            if (!category) throw createHttpError(404, "Category not found");

            const newStatus = !category.isActive;
            await category.update({ isActive: newStatus }, { transaction });
            return { category, newStatus };
        });

        res.json({ success: true, data: result.category, message: `Category ${result.newStatus ? 'activated' : 'deactivated'}` });
    } catch (error) {
        next(error);
    }
};
