/**
 * Product Type Service - Neon-Safe Version
 * Aligned with the new middleware-driven transaction pattern
 */

const createHttpError = require('http-errors');
const { safeQuery } = require("../../utils/safeQuery");

/**
 * Get all product types
 */
const getProductTypes = async (req) => {
    const { businessId } = req;
    
    return await req.readWithTenant(async (context) => {
        const { transactionModels: models } = context;
        const { ProductType } = models;
        
        const types = await safeQuery(
            () => ProductType.findAll({
                where: { businessId },
                order: [['name', 'ASC']]
            }),
            []
        );
        
        return types;
    });
};

/**
 * Create a new product type
 */
const createProductType = async (req) => {
    const { businessId } = req;
    const { name, description, categoryId } = req.body;
    
    return await req.executeWithTenant(async (context) => {
        const { transaction, transactionModels: models } = context;
        const { ProductType } = models;

        const type = await ProductType.create({
            businessId,
            name,
            description,
            categoryId
        }, { transaction });
        
        return type;
    });
};

/**
 * Update a product type
 */
const updateProductType = async (req) => {
    const { businessId } = req;
    const { id } = req.params;
    const { name, description, categoryId } = req.body;
    
    return await req.executeWithTenant(async (context) => {
        const { transaction, transactionModels: models } = context;
        const { ProductType } = models;

        const type = await ProductType.findOne({
            where: { id, businessId },
            transaction
        });

        if (!type) {
            throw createHttpError(404, 'Product type not found');
        }
        
        await type.update({
            name,
            description,
            categoryId
        }, { transaction });
        
        return type;
    });
};

/**
 * Delete a product type
 */
const deleteProductType = async (req) => {
    const { businessId } = req;
    const { id } = req.params;
    
    return await req.executeWithTenant(async (context) => {
        const { transaction, transactionModels: models } = context;
        const { ProductType } = models;

        const type = await ProductType.findOne({
            where: { id, businessId },
            transaction
        });

        if (!type) {
            throw createHttpError(404, 'Product type not found');
        }
        
        await type.destroy({ transaction });
        return { success: true };
    });
};

module.exports = {
    getProductTypes,
    createProductType,
    updateProductType,
    deleteProductType
};
