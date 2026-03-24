const { Op } = require('sequelize');
const { assertTransaction, assertTenant } = require('../../src/utils/guards');

/**
 * Product Repository - DATA-FIRST REFACTORED
 */
const productRepository = {
    /**
     * Find all products for a business/outlet
     */
    findAll: async ({ models, transaction, businessId, outletId, filters = {} }) => {
        assertTransaction(transaction);
        assertTenant(businessId);
        
        const { Product, Category } = models;
        const where = { businessId };
        
        if (outletId) where.outletId = outletId;
        if (filters.categoryId) where.categoryId = filters.categoryId;
        if (filters.productTypeId) where.productTypeId = filters.productTypeId;

        return await Product.findAll({
            where,
            include: [
                { model: Category, as: 'category' }
            ],
            order: [['name', 'ASC']],
            transaction
        });
    },

    /**
     * Find a product by ID
     */
    findById: async ({ models, transaction, businessId, outletId, id }) => {
        assertTransaction(transaction);
        assertTenant(businessId);
        
        const { Product, Category } = models;
        const where = { id, businessId };
        if (outletId) where.outletId = outletId;
        
        return await Product.findOne({ 
            where,
            include: [{ model: Category, as: 'category' }],
            transaction
        });
    },

    /**
     * Create a new product
     */
    create: async ({ models, transaction, businessId, outletId, data }) => {
        assertTransaction(transaction);
        assertTenant(businessId);
        
        if (!outletId) {
            throw new Error("Outlet context required for product creation");
        }

        const { Product } = models;
        return await Product.create({
            ...data,
            businessId,
            outletId: data.outletId || outletId
        }, { transaction });
    },

    /**
     * Update a product
     */
    update: async ({ models, transaction, businessId, outletId, id, data }) => {
        assertTransaction(transaction);
        
        const product = await productRepository.findById({ models, transaction, businessId, outletId, id });
        if (!product) return null;

        return await product.update(data, { transaction });
    },

    /**
     * Delete a product
     */
    delete: async ({ models, transaction, businessId, outletId, id }) => {
        assertTransaction(transaction);
        
        const product = await productRepository.findById({ models, transaction, businessId, outletId, id });
        if (!product) return false;

        await product.destroy({ transaction });
        return true;
    }
};

module.exports = productRepository;
