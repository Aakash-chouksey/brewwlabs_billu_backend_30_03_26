/**
 * PRODUCT CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");
const { Op } = require("sequelize");
const { safeQuery } = require("../utils/safeQuery");

/**
 * Get all products
 */
exports.getProducts = async (req, res, next) => {
    try {
        const { businessId } = req;
        const { category, search, isActive } = req.query;

        const result = await req.executeRead(async ({ models }) => {
            const { Product, Category, ProductType } = models;
            
            const whereClause = { businessId };
            if (isActive !== undefined) whereClause.isActive = isActive === 'true';

            const include = [
                { model: Category, as: 'category' },
                { model: ProductType, as: 'productType' }
            ];

            if (category) {
                include[0].where = { id: category };
                include[0].required = true;
            }

            if (search) {
                whereClause[Op.or] = [
                    { name: { [Op.iLike]: `%${search}%` } },
                    { sku: { [Op.iLike]: `%${search}%` } },
                    { description: { [Op.iLike]: `%${search}%` } }
                ];
            }

            return await safeQuery(
                () => Product.findAll({
                    where: whereClause,
                    include,
                    order: [['name', 'ASC']]
                }),
                []
            );
        });

        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

/**
 * Add new product
 */
exports.addProduct = async (req, res, next) => {
    try {
        const { businessId } = req;
        const { name, description, price, cost, categoryId, sku, barcode, image, isActive, taxRate } = req.body;

        if (!name || !price) {
            throw createHttpError(400, "Product name and price are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Product, Category } = models;
            
            // Check if SKU is unique
            if (sku) {
                const existing = await safeQuery(
                    () => Product.findOne({
                        where: { businessId, sku },
                        transaction
                    }),
                    null
                );
                if (existing) throw createHttpError(400, "SKU already exists");
            }

            // Verify category exists if provided
            if (categoryId) {
                const category = await safeQuery(
                    () => Category.findOne({
                        where: { id: categoryId, businessId },
                        transaction
                    }),
                    null
                );
                if (!category) throw createHttpError(404, "Category not found");
            }

            return await Product.create({
                businessId,
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
        });

        res.status(201).json({ success: true, data: result, message: "Product created" });
    } catch (error) {
        next(error);
    }
};

/**
 * Update product
 */
exports.updateProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { businessId } = req;
        const updateData = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Product } = models;
            
            const product = await safeQuery(
                () => Product.findOne({
                    where: { id, businessId },
                    transaction
                }),
                null
            );
            if (!product) throw createHttpError(404, "Product not found");

            // Check SKU uniqueness if changing
            if (updateData.sku && updateData.sku !== product.sku) {
                const existing = await safeQuery(
                    () => Product.findOne({
                        where: { businessId, sku: updateData.sku, id: { [Op.ne]: id } },
                        transaction
                    }),
                    null
                );
                if (existing) throw createHttpError(400, "SKU already exists");
            }

            await product.update(updateData, { transaction });
            return product;
        });

        res.json({ success: true, data: result, message: "Product updated" });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete product
 */
exports.deleteProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { businessId } = req;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Product, OrderItem, InventoryItem } = models;
            
            // Phase 2: Safe dependency checks
            const orderItemsCount = await safeQuery(
                () => OrderItem.count({
                    where: { productId: id },
                    transaction
                }),
                0
            );
            if (orderItemsCount > 0) {
                throw createHttpError(400, `Cannot delete product with ${orderItemsCount} order items`);
            }

            const inventoryCount = await safeQuery(
                () => InventoryItem.count({
                    where: { productId: id },
                    transaction
                }),
                0
            );
            if (inventoryCount > 0) {
                throw createHttpError(400, `Cannot delete product with inventory records`);
            }

            const product = await safeQuery(
                () => Product.findOne({
                    where: { id, businessId },
                    transaction
                }),
                null
            );
            if (!product) throw createHttpError(404, "Product not found");

            await product.destroy({ transaction });
        });

        res.json({ success: true, message: "Product deleted" });
    } catch (error) {
        next(error);
    }
};
