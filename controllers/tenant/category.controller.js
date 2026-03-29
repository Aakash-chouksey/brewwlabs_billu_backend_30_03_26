/**
 * CATEGORY CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");
const { Op } = require("sequelize");
const { uploadImageToCloudinary } = require("../../src/utils/imageUpload");

/**
 * Get all categories
 */
exports.getCategories = async (req, res, next) => {
    try {
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;

        const cacheKey = `categories_${outlet_id || 'all'}`;
        const result = await req.readWithCache(business_id, cacheKey, async (context) => {
            const { transactionModels: models } = context;
            const { Category } = models;
            
            return await Category.findAll({
                where: { businessId: business_id, outletId: outlet_id },
                order: [['sortOrder', 'ASC'], ['name', 'ASC']]
            });
        }, { ttl: 600000 }); // 10 minute cache

        const responseData = result.data || result || [];
        res.json({ 
            success: true, 
            data: responseData,
            message: "Categories retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Add new category
 */
exports.addCategory = async (req, res, next) => {
    try {
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;
        const { name, description, color, image, isEnabled, sortOrder } = req.body;

        if (!name) {
            throw createHttpError(400, "Category name is required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Category } = models;
            
            // Check for duplicate name in same outlet
            const existing = await Category.findOne({
                where: { businessId: business_id, outletId: outlet_id, name: { [Op.iLike]: name } },
                transaction
            });
            if (existing) throw createHttpError(400, "Category with this name already exists in this outlet");

            // Handle image upload if present
            let finalImageUrl = image;
            if (req.file) {
                const uploadResult = await uploadImageToCloudinary(req.file.buffer, 'categories');
                finalImageUrl = uploadResult.url;
            }

            return await Category.create({
                businessId: business_id,
                outletId: outlet_id,
                name,
                description,
                color: color || '#3B82F6',
                image: finalImageUrl,
                isEnabled: isEnabled !== undefined ? isEnabled : true,
                sortOrder: sortOrder || 0
            }, { transaction });
        });

        const responseData = result.data || result;
        res.status(201).json({ 
            success: true, 
            data: responseData, 
            message: "Category created successfully" 
        });
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
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;
        const updateData = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Category } = models;
            
            const category = await Category.findOne({
                where: { id, businessId: business_id, outletId: outlet_id },
                transaction
            });
            if (!category) throw createHttpError(404, "Category not found");

            // Check name uniqueness if changing
            if (updateData.name && updateData.name.toLowerCase() !== category.name.toLowerCase()) {
                const existing = await Category.findOne({
                    where: { businessId: business_id, outletId: outlet_id, name: { [Op.iLike]: updateData.name }, id: { [Op.ne]: id } },
                    transaction
                });
                if (existing) throw createHttpError(400, "Another category already has this name");
            }

            // Handle image upload if present
            if (req.file) {
                const uploadResult = await uploadImageToCloudinary(req.file.buffer, 'categories');
                updateData.image = uploadResult.url;
            }

            await category.update(updateData, { transaction });
            return category;
        });

        const responseData = result.data || result;
        res.json({ 
            success: true, 
            data: responseData, 
            message: "Category updated successfully" 
        });
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
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Category, Product } = models;
            
            // Check for dependencies
            const productsCount = await Product.count({
                where: { categoryId: id, businessId: business_id },
                transaction
            });
            if (productsCount > 0) {
                throw createHttpError(400, `Cannot delete category with ${productsCount} associated products`);
            }

            const category = await Category.findOne({
                where: { id, businessId: business_id, outletId: outlet_id },
                transaction
            });
            if (!category) throw createHttpError(404, "Category not found");

            await category.destroy({ transaction });
        });

        res.json({ 
            success: true, 
            message: "Category deleted successfully" 
        });
    } catch (error) {
        next(error);
    }
};
