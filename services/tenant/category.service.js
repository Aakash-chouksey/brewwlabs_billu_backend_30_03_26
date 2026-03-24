/**
 * Category Service - Neon-Safe Version
 * All database operations use transaction-safe patterns
 */

const createHttpError = require('http-errors');

/**
 * Category Service
 * Handles business logic for category operations
 */
const categoryService = {
    /**
     * Create a new category
     */
    addCategory: async (req, data) => {
        const { name, description, color, image, isEnabled = true } = data;
        
        return await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Category } = models;

            // Validate required fields
            if (!name) {
                throw createHttpError(400, 'Category name is required');
            }

            // Check if category with same name exists
            const existingCategory = await Category.findOne({
                where: { name },
                transaction
            });

            if (existingCategory) {
                throw createHttpError(409, 'Category with this name already exists');
            }

            // Create category
            const category = await Category.create({
                name,
                description,
                color,
                image,
                isEnabled,
                businessId: req.businessId,
                outletId: req.outletId
            }, { transaction });

            return category;
        });
    },

    /**
     * Get all categories
     */
    getCategories: async (req) => {
        return await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Category } = models;

            const categories = await Category.findAll({
                where: {
                    businessId: req.businessId,
                    outletId: req.outletId
                },
                order: [['name', 'ASC']]
            });

            return categories;
        });
    },

    /**
     * Update a category
     */
    updateCategory: async (req, id, updateData) => {
        return await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Category } = models;

            // Find category
            const category = await Category.findOne({
                where: {
                    id,
                    businessId: req.businessId,
                    outletId: req.outletId
                },
                transaction
            });

            if (!category) {
                throw createHttpError(404, 'Category not found');
            }

            // Check for duplicate name if name is being updated
            if (updateData.name && updateData.name !== category.name) {
                const existingCategory = await Category.findOne({
                    where: {
                        name: updateData.name,
                        id: { [require('sequelize').Op.ne]: id }
                    },
                    transaction
                });

                if (existingCategory) {
                    throw createHttpError(409, 'Category with this name already exists');
                }
            }

            // Update category
            await category.update(updateData, { transaction });

            return category;
        });
    },

    /**
     * Delete a category
     */
    deleteCategory: async (req, id) => {
        return await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Category, Product } = models;

            // Find category
            const category = await Category.findOne({
                where: {
                    id,
                    businessId: req.businessId,
                    outletId: req.outletId
                },
                transaction
            });

            if (!category) {
                throw createHttpError(404, 'Category not found');
            }

            // Check if category has products
            const productCount = await Product.count({
                where: { categoryId: id },
                transaction
            });

            if (productCount > 0) {
                throw createHttpError(400, 'Cannot delete category with existing products');
            }

            // Delete category
            await category.destroy({ transaction });

            return { success: true, message: 'Category deleted successfully' };
        });
    }
};

module.exports = categoryService;
