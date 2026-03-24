const { assertTransaction, assertTenant } = require('../../src/utils/guards');

/**
 * Product Type Repository - DATA-FIRST REFACTORED
 */
const productTypeRepository = {
    /**
     * Find all product types for a business/outlet
     */
    findAll: async ({ models, transaction, businessId, outletId }) => {
        assertTransaction(transaction);
        assertTenant(businessId);
        
        const { ProductType } = models;
        const where = { businessId };
        if (outletId) where.outletId = outletId;
        
        return await ProductType.findAll({
            where,
            order: [['name', 'ASC']],
            transaction
        });
    },

    /**
     * Create a new product type
     */
    create: async ({ models, transaction, businessId, outletId, data }) => {
        assertTransaction(transaction);
        assertTenant(businessId);
        
        const { ProductType } = models;
        return await ProductType.create({
            ...data,
            businessId,
            outletId
        }, { transaction });
    },

    /**
     * Update a product type
     */
    update: async ({ models, transaction, businessId, outletId, id, data }) => {
        assertTransaction(transaction);
        assertTenant(businessId);
        
        const { ProductType } = models;
        const where = { id, businessId };
        if (outletId) where.outletId = outletId;

        const productType = await ProductType.findOne({ where, transaction });
        if (!productType) return null;

        return await productType.update(data, { transaction });
    },

    /**
     * Delete a product type
     */
    delete: async ({ models, transaction, businessId, outletId, id }) => {
        assertTransaction(transaction);
        assertTenant(businessId);
        
        const { ProductType } = models;
        const where = { id, businessId };
        if (outletId) where.outletId = outletId;

        const productType = await ProductType.findOne({ where, transaction });
        if (!productType) return false;

        await productType.destroy({ transaction });
        return true;
    },

    /**
     * Count products associated with a product type
     */
    countProducts: async ({ models, transaction, businessId, outletId, productTypeId }) => {
        assertTransaction(transaction);
        assertTenant(businessId);
        
        const { Product } = models;
        const where = { productTypeId, businessId };
        if (outletId) where.outletId = outletId;
        
        return await Product.count({ where, transaction });
    }
};

module.exports = productTypeRepository;
