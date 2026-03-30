/**
 * PRODUCT CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");
const { Op } = require("sequelize");
const { uploadImageToCloudinary } = require("../../src/utils/imageUpload");
const { enforceOutletScope, buildStrictWhereClause } = require("../../utils/outletGuard");

/**
 * Get all products
 */
exports.getProducts = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;
        const { category, search, isActive } = req.query;

        const cacheKey = `products_${outlet_id}_c${category || 'all'}_s${search || 'none'}_a${isActive || 'any'}`;
        const result = await req.readWithCache(business_id, cacheKey, async (context) => {
            const { transactionModels: models } = context;
            const { Product, Category, ProductType, Inventory } = models;
            
            const whereClause = { businessId: business_id, outletId: outlet_id };
            if (isActive !== undefined) whereClause.isActive = isActive === 'true';

            const include = [
                { model: Category, as: 'category' },
                { model: ProductType, as: 'productType' },
                { model: Inventory, as: 'inventory', attributes: ['quantity'] }
            ];

            if (category) {
                // Category must also belong to same outlet
                include[0].where = { id: category, businessId: business_id, outletId: outlet_id };
                include[0].required = true;
            }

            if (search) {
                whereClause[Op.or] = [
                    { name: { [Op.iLike]: `%${search}%` } },
                    { sku: { [Op.iLike]: `%${search}%` } },
                    { description: { [Op.iLike]: `%${search}%` } }
                ];
            }

            const products = await Product.findAll({
                where: whereClause,
                include,
                order: [['name', 'ASC']]
            });
            
            // Map result to include legacy current_stock field for backward compatibility
            return products.map(p => {
                const plain = p.get({ plain: true });
                return {
                    ...plain,
                    current_stock: plain.inventory?.quantity || 0,
                    currentStock: plain.inventory?.quantity || 0
                };
            });
        }, { ttl: 300000 }); // 5 minute cache

        const data = Array.isArray(result) ? result : (result?.data || []);
        
        res.json({ 
            success: true, 
            data: data,
            message: "Products retrieved successfully"
        }); 
    } catch (error) {
        next(error);
    }
};

/**
 * Add new product
 */
exports.addProduct = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;
        const { name, description, price, cost, categoryId, productTypeId, sku, barcode, image, isActive, taxRate } = req.body;

        if (!name || !price || !categoryId) {
            throw createHttpError(400, "Product name, price, and category are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Product, Category, ProductType } = models;
            
            // Check if SKU is unique within outlet
            if (sku) {
                const existing = await Product.findOne({
                    where: { businessId: business_id, outletId: outlet_id, sku },
                    transaction
                });
                if (existing) throw createHttpError(400, "SKU already exists in this outlet");
            }

            // Verify category exists in this outlet
            const category = await Category.findOne({
                where: { id: categoryId, businessId: business_id, outletId: outlet_id },
                transaction
            });
            if (!category) throw createHttpError(404, "Selected category not found in this outlet");

            // Verify productType exists if provided
            if (productTypeId) {
                const productType = await ProductType.findOne({
                    where: { id: productTypeId, businessId: business_id, outletId: outlet_id },
                    transaction
                });
                if (!productType) throw createHttpError(404, "Selected product type not found in this outlet");
            }

            // Handle image upload if present
            let finalImageUrl = image;
            if (req.file) {
                const uploadResult = await uploadImageToCloudinary(req.file.buffer, 'products');
                finalImageUrl = uploadResult.url;
            }

            return await Product.create({
                businessId: business_id,
                outletId: outlet_id,
                name,
                description,
                price,
                cost: cost || 0,
                categoryId: categoryId,
                productTypeId: productTypeId || null,
                sku,
                barcode,
                image: finalImageUrl,
                isActive: isActive !== undefined ? isActive : true,
                taxRate: taxRate || 0
            }, { transaction });
        });

        const responseData = result.data || result;
        res.status(201).json({ 
            success: true, 
            data: responseData, 
            message: "Product created successfully" 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update product
 */
exports.updateProduct = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { id } = req.params;
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;
        const updateData = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Product, ProductType } = models;
            
            const product = await Product.findOne({ where: { id, businessId: business_id, outletId: outlet_id }, transaction });
            if (!product) throw createHttpError(404, "Product not found");

            // Check SKU uniqueness if changing
            if (updateData.sku && updateData.sku !== product.sku) {
                const existing = await Product.findOne({
                    where: { businessId: business_id, outletId: outlet_id, sku: updateData.sku, id: { [Op.ne]: id } },
                    transaction
                });
                if (existing) throw createHttpError(400, "SKU already exists in this outlet");
            }

            // Verify productType exists if provided and changing
            if (updateData.productTypeId && updateData.productTypeId !== product.productTypeId) {
                const productType = await ProductType.findOne({
                    where: { id: updateData.productTypeId, businessId: business_id, outletId: outlet_id },
                    transaction
                });
                if (!productType) throw createHttpError(404, "Selected product type not found in this outlet");
            }

            // Handle image upload if present
            if (req.file) {
                const uploadResult = await uploadImageToCloudinary(req.file.buffer, 'products');
                updateData.image = uploadResult.url;
            }

            // Clean up productTypeId - set to null if empty string
            if (updateData.productTypeId === '' || updateData.productTypeId === undefined) {
                updateData.productTypeId = null;
            }

            await product.update(updateData, { transaction });
            return product;
        });

        const responseData = result.data || result;
        res.json({ 
            success: true, 
            data: responseData, 
            message: "Product updated successfully" 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete product
 */
exports.deleteProduct = async (req, res, next) => {
    try {
        enforceOutletScope(req);
        const { id } = req.params;
        const business_id = req.business_id || req.businessId;
        const outlet_id = req.outlet_id || req.outletId;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Product, OrderItem } = models;
            
            // Check for order dependencies
            const orderItemsCount = await OrderItem.count({
                where: { productId: id, businessId: business_id },
                transaction
            });
            if (orderItemsCount > 0) {
                throw createHttpError(400, `Cannot delete product with existing orders`);
            }

            const product = await Product.findOne({ where: { id, businessId: business_id, outletId: outlet_id }, transaction });
            if (!product) throw createHttpError(404, "Product not found");

            await product.destroy({ transaction });
        });

        res.json({ 
            success: true, 
            message: "Product deleted successfully" 
        });
    } catch (error) {
        next(error);
    }
};
