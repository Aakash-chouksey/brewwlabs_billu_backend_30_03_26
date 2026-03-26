/**
 * PRODUCT CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");
const { Op } = require("sequelize");
const { enforceOutletScope, buildStrictWhereClause } = require("../utils/outletGuard");

/**
 * Get all products
 */
exports.getProducts = async (req, res, next) => {
    try {
        const { businessId, outletId } = req;
        const { category, search, isActive } = req.query;

        console.log("STEP 2 - Calling Executor (readWithTenant)");
        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Product, Category, ProductType } = models;
            
            const whereClause = { businessId, outletId };
            if (isActive !== undefined) whereClause.isActive = isActive === 'true';

            const include = [
                { model: Category, as: 'category' },
                { model: ProductType, as: 'productType' }
            ];

            if (category) {
                include[0].where = { id: category, businessId, outletId };
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
            console.log("STEP 4 - DB RESULT (Products):", Array.isArray(products) ? products.length : 'not an array');
            console.log("DB DATA (Phase 3):", products ? products.slice(0, 2) : 'no data'); // Phase 3 log
            return products;
        });

        console.log("STEP 6 - Controller Received:", result);
        console.log("STEP 6.1 - Data:", result?.data);
        console.log("STEP 7 - Sending Response:", result?.data);
        const data = result.data;
        
        // Handle empty results gracefully (STEP 6)
        if (!data || (Array.isArray(data) && data.length === 0)) {
            console.log("ℹ️ No products found for this query");
            return res.json({ success: true, data: [] });
        }
        
        return res.json({ success: true, data: data }); 
    } catch (error) {
        next(error);
    }
};

/**
 * Add new product
 */
exports.addProduct = async (req, res, next) => {
    try {
        console.log("STEP 1 - Controller Start - addProduct");
        const { businessId, outletId } = req;
        const { name, description, price, cost, categoryId, sku, barcode, image, isActive, taxRate } = req.body;
        console.log("STEP 2 - Calling Executor (executeWithTenant)");

        if (!name || !price || !categoryId) {
            throw createHttpError(400, "Product name, price, and category are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Product, Category } = models;
            
            // Check if SKU is unique
            if (sku) {
                const existing = await Product.findOne({
                    where: { businessId, outletId, sku },
                    transaction
                });
                if (existing) throw createHttpError(400, "SKU already exists");
            }

            // Verify category exists if provided
            if (categoryId) {
                const category = await Category.findOne({
                    where: { id: categoryId, businessId, outletId },
                    transaction
                });
                if (!category) throw createHttpError(404, "Category not found for this outlet");
            }

            return await Product.create({
                businessId,
                outletId,
                name,
                description,
                price,
                cost: cost || 0,
                categoryId,
                sku,
                barcode,
                image,
                isActive: isActive !== undefined ? isActive : true,
                taxRate: taxRate || 0
            }, { transaction });
            console.log("STEP 4 - DB RESULT (Product Created):", result?.id);
            return result;
        });

        console.log("STEP 6 - Controller Received:", result);
        console.log("STEP 6.1 - Data:", result?.data);
        console.log("STEP 7 - Sending Response:", result?.data);
        res.status(201).json({ success: true, data: result.data, message: "Product created" });
    } catch (error) {
        next(error);
    }
};

/**
 * Update product
 */
exports.updateProduct = async (req, res, next) => {
    try {
        console.log("STEP 1 - Controller Start - updateProduct");
        const { id } = req.params;
        const { businessId, outletId } = req;
        const updateData = req.body;
        console.log("STEP 2 - Calling Executor (executeWithTenant)");

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Product } = models;
            
            const product = await Product.findOne({ where: { id, businessId, outletId }, transaction });
            if (!product) throw createHttpError(404, "Product not found");

            // Check SKU uniqueness if changing
            if (updateData.sku && updateData.sku !== product.sku) {
                const existing = await Product.findOne({
                    where: { businessId, outletId, sku: updateData.sku, id: { [Op.ne]: id } },
                    transaction
                });
                if (existing) throw createHttpError(400, "SKU already exists");
            }

            await product.update(updateData, { transaction });
            console.log("STEP 4 - DB RESULT (Product Updated):", product.id);
            return product;
        });

        console.log("STEP 6 - Controller Received:", result);
        console.log("STEP 6.1 - Data:", result?.data);
        console.log("STEP 7 - Sending Response:", result?.data);
        res.json({ success: true, data: result.data, message: "Product updated" });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete product
 */
exports.deleteProduct = async (req, res, next) => {
    try {
        console.log("STEP 1 - Controller Start - deleteProduct");
        const { id } = req.params;
        const { businessId, outletId } = req;
        console.log("STEP 2 - Calling Executor (executeWithTenant)");

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Product, OrderItem, InventoryItem } = models;
            
            const orderItemsCount = await OrderItem.count({
                where: { productId: id, businessId },
                transaction
            });
            if (orderItemsCount > 0) {
                throw createHttpError(400, `Cannot delete product with existing order items`);
            }

            const product = await Product.findOne({ where: { id, businessId, outletId }, transaction });
            if (!product) throw createHttpError(404, "Product not found");

            await product.destroy({ transaction });
        });

        res.json({ success: true, message: "Product deleted" });
    } catch (error) {
        next(error);
    }
};
