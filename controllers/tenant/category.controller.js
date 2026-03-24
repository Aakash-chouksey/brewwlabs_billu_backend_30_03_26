/**
 * CATEGORY CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");
const { Op } = require("sequelize");
const { safeQuery } = require("../../utils/safeQuery");
const cache = require("../../utils/cache");

/**
 * Get all categories
 */
exports.getCategories = async (req, res, next) => {
    try {
        const { businessId, outletId } = req;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Category } = models;
            
            return await safeQuery(
                () => Category.findAll({
                    where: { businessId, outletId },
                    order: [['sortOrder', 'ASC'], ['name', 'ASC']]
                }),
                []
            );
        });

        console.log('[CATEGORY CONTROLLER] getCategories result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData || [] });
    } catch (error) {
        next(error);
    }
};

/**
 * Add new category
 */
exports.addCategory = async (req, res, next) => {
    try {
        const { businessId, outletId } = req;
        const { name, description, color, image, isEnabled, sortOrder } = req.body;

        if (!name) {
            throw createHttpError(400, "Category name is required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Category } = models;
            
            // Check for duplicate name in same outlet
            const existing = await safeQuery(
                () => Category.findOne({
                    where: { businessId, outletId, name: { [Op.iLike]: name } },
                    transaction
                }),
                null
            );
            if (existing) throw createHttpError(400, "Category with this name already exists in this outlet");

            return await Category.create({
                businessId,
                outletId,
                name,
                description,
                color: color || '#3B82F6',
                image,
                isEnabled: isEnabled !== undefined ? isEnabled : true,
                sortOrder: sortOrder || 0
            }, { transaction });
        });

        // Invalidate cache
        const cacheKey = cache.generateKey(req, 'categories');
        await cache.del(cacheKey);

        console.log('[CATEGORY CONTROLLER] addCategory result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.status(201).json({ success: true, data: responseData, message: "Category created" });
    } catch (error) {
        next(error);
    }
};

/**
 * Update category
 */
exports.updateCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { businessId, outletId } = req;
        const updateData = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Category } = models;
            
            const category = await safeQuery(
                () => Category.findOne({
                    where: { id, businessId, outletId },
                    transaction
                }),
                null
            );
            if (!category) throw createHttpError(404, "Category not found");

            // Check name uniqueness if changing
            if (updateData.name && updateData.name.toLowerCase() !== category.name.toLowerCase()) {
                const existing = await safeQuery(
                    () => Category.findOne({
                        where: { businessId, outletId, name: { [Op.iLike]: updateData.name }, id: { [Op.ne]: id } },
                        transaction
                    }),
                    null
                );
                if (existing) throw createHttpError(400, "Another category already has this name");
            }

            await category.update(updateData, { transaction });
            return category;
        });

        // Invalidate cache
        const cacheKey = cache.generateKey(req, 'categories');
        await cache.del(cacheKey);

        console.log('[CATEGORY CONTROLLER] updateCategory result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData, message: "Category updated" });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete category
 */
exports.deleteCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { businessId, outletId } = req;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Category, Product } = models;
            
            // Check for dependencies
            const productsCount = await safeQuery(
                () => Product.count({
                    where: { categoryId: id, businessId },
                    transaction
                }),
                0
            );
            if (productsCount > 0) {
                throw createHttpError(400, `Cannot delete category with ${productsCount} associated products`);
            }

            const category = await safeQuery(
                () => Category.findOne({
                    where: { id, businessId, outletId },
                    transaction
                }),
                null
            );
            if (!category) throw createHttpError(404, "Category not found");

            await category.destroy({ transaction });
        });

        // Invalidate cache
        const cacheKey = cache.generateKey(req, 'categories');
        await cache.del(cacheKey);

        res.json({ success: true, message: "Category deleted" });
    } catch (error) {
        next(error);
    }
};
