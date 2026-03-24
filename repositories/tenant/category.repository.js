const { assertTransaction, assertTenant } = require('../../src/utils/guards');

/**
 * Category Repository - DATA-FIRST REFACTORED
 */
const categoryRepository = {
    /**
     * Find all categories for a business
     */
    findAll: async ({ models, transaction, businessId, outletId }) => {
        assertTransaction(transaction);
        assertTenant(businessId);
        
        const { Category } = models;
        const where = { businessId };
        if (outletId) where.outletId = outletId;
        
        return await Category.findAll({
            where,
            order: [['sortOrder', 'ASC'], ['name', 'ASC']],
            transaction
        });
    },

    /**
     * Find a category by ID
     */
    findById: async ({ models, transaction, businessId, id }) => {
        assertTransaction(transaction);
        assertTenant(businessId);
        
        const { Category } = models;
        return await Category.findOne({ 
            where: { id, businessId },
            transaction
        });
    },

    /**
     * Create a new category
     */
    create: async ({ models, transaction, businessId, outletId, data }) => {
        assertTransaction(transaction);
        assertTenant(businessId);
        
        const { Category } = models;
        return await Category.create({
            ...data,
            businessId,
            outletId
        }, { transaction });
    },

    /**
     * Update a category
     */
    update: async ({ models, transaction, businessId, id, data }) => {
        assertTransaction(transaction);
        
        const category = await categoryRepository.findById({ models, transaction, businessId, id });
        if (!category) return null;

        return await category.update(data, { transaction });
    },

    /**
     * Delete a category
     */
    delete: async ({ models, transaction, businessId, id }) => {
        assertTransaction(transaction);
        
        const category = await categoryRepository.findById({ models, transaction, businessId, id });
        if (!category) return false;

        await category.destroy({ transaction });
        return true;
    },

    /**
     * Count products associated with a category
     */
    countProducts: async ({ models, transaction, businessId, categoryId }) => {
        assertTransaction(transaction);
        assertTenant(businessId);
        
        const { Product } = models;
        return await Product.count({ 
            where: { categoryId, businessId },
            transaction
        });
    }
};

module.exports = categoryRepository;
