/**
 * Product Type Service - Neon-Safe Version
 * Aligned with the new middleware-driven transaction pattern
 */

const createHttpError = require('http-errors');

/**
 * Get all product types
 */
const getProductTypes = async (req) => {
    const business_id = req.business_id || req.businessId;
    const outlet_id = req.outlet_id || req.outletId;
    
    return await req.readWithTenant(async (context) => {
        const { transactionModels: models } = context;
        const { ProductType } = models;
        
        const types = await ProductType.findAll({
            where: { businessId: business_id, outletId: outlet_id },
            order: [['name', 'ASC']]
        });
        
        return types;
    });
};

/**
 * Create a new product type
 */
const createProductType = async (req, data) => {
    const business_id = req.business_id || req.businessId;
    const outlet_id = req.outlet_id || req.outletId;
    const { name, description, categoryId, icon, color } = data || req.body;
    
    return await req.executeWithTenant(async (context) => {
        const { transaction, transactionModels: models } = context;
        const { ProductType } = models;

        const type = await ProductType.create({
            businessId: business_id,
            outletId: outlet_id,
            name,
            description,
            categoryId,
            icon,
            color
        }, { transaction });
        
        return type;
    });
};

/**
 * Update a product type
 */
const updateProductType = async (req, id, data) => {
    const business_id = req.business_id || req.businessId;
    const { name, description, categoryId, icon, color } = data || req.body;
    
    return await req.executeWithTenant(async (context) => {
        const { transaction, transactionModels: models } = context;
        const { ProductType } = models;

        const type = await ProductType.findOne({
            where: { id, businessId: business_id },
            transaction
        });

        if (!type) {
            throw createHttpError(404, 'Product type not found');
        }
        
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (categoryId !== undefined) updateData.categoryId = categoryId;
        if (icon !== undefined) updateData.icon = icon;
        if (color !== undefined) updateData.color = color;

        await type.update(updateData, { transaction });
        
        return type;
    });
};

/**
 * Delete a product type
 */
const deleteProductType = async (req, id) => {
    const business_id = req.business_id || req.businessId;
    
    return await req.executeWithTenant(async (context) => {
        const { transaction, transactionModels: models } = context;
        const { ProductType } = models;

        const type = await ProductType.findOne({
            where: { id, businessId: business_id },
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
