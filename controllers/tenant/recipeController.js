/**
 * RECIPE CONTROLLER - Neon-Safe Version
 * Standardized for transaction-scoped model access and consistent multi-tenancy.
 */

const createHttpError = require("http-errors");
const { Op } = require("sequelize");

/**
 * Get all recipes
 */
exports.getRecipes = async (req, res, next) => {
    try {
        const business_id = req.business_id || req.businessId;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Recipe, Product } = models;
            
            return await Recipe.findAll({
                where: { businessId: business_id },
                include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'sku'] }],
                order: [['name', 'ASC']]
            });
        });

        const data = result.data || result || [];
        res.json({ 
            success: true, 
            data: data,
            count: data.length,
            message: "Recipes retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get single recipe
 */
exports.getRecipe = async (req, res, next) => {
    try {
        const { id } = req.params;
        const business_id = req.business_id || req.businessId;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Recipe, RecipeItem, Product, InventoryItem } = models;

            const recipe = await Recipe.findOne({
                where: { id, businessId: business_id },
                include: [
                    { model: Product, as: 'product', attributes: ['id', 'name', 'sku', 'price'] },
                    { 
                        model: RecipeItem, 
                        as: 'ingredients', 
                        include: [{ model: InventoryItem, as: 'inventoryItem' }]
                    }
                ]
            });

            if (!recipe) throw createHttpError(404, "Recipe not found");
            return recipe;
        });

        const data = result.data || result;
        res.json({ 
            success: true, 
            data: data,
            message: "Recipe details retrieved successfully"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create new recipe
 */
exports.createRecipe = async (req, res, next) => {
    try {
        const business_id = req.business_id || req.businessId;
        const { name, description, productId, ingredients, instructions, yield: yieldAmount } = req.body;

        if (!name || !productId || !ingredients || !Array.isArray(ingredients)) {
            throw createHttpError(400, "Name, product ID, and ingredients are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Recipe, RecipeItem, Product } = models;
            
            const product = await Product.findOne({
                where: { id: productId, businessId: business_id },
                transaction
            });
            if (!product) throw createHttpError(404, "Product not found");

            const recipe = await Recipe.create({
                businessId: business_id,
                name,
                description,
                productId,
                instructions: instructions || '',
                yield: Number(yieldAmount) || 1
            }, { transaction });

            await RecipeItem.bulkCreate(
                ingredients.map(ing => ({
                    recipeId: recipe.id,
                    inventoryItemId: ing.inventoryId,
                    quantityRequired: ing.quantity,
                    unit: ing.unit,
                    notes: ing.notes || ''
                })),
                { transaction }
            );

            return recipe;
        });

        const data = result.data || result;
        res.status(201).json({ 
            success: true, 
            data: data, 
            message: "Recipe created successfully" 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update recipe
 */
exports.updateRecipe = async (req, res, next) => {
    try {
        const { id } = req.params;
        const business_id = req.business_id || req.businessId;
        const { ingredients, ...updateData } = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Recipe, RecipeItem, Product, InventoryItem } = models;
            
            const recipe = await Recipe.findOne({
                where: { id, businessId: business_id },
                transaction
            });
            
            if (!recipe) throw createHttpError(404, "Recipe not found");

            // Avoid updating primary keys/identifiers
            delete updateData.id;
            delete updateData.businessId;

            await recipe.update(updateData, { transaction });

            if (ingredients && Array.isArray(ingredients)) {
                await RecipeItem.destroy({ where: { recipeId: id }, transaction });
                await RecipeItem.bulkCreate(
                    ingredients.map(ing => ({
                        recipeId: id,
                        inventoryItemId: ing.inventoryId,
                        quantityRequired: ing.quantity,
                        unit: ing.unit,
                        notes: ing.notes || ''
                    })),
                    { transaction }
                );
            }

            return await Recipe.findByPk(id, {
                include: [
                    { model: Product, as: 'product', attributes: ['id', 'name', 'sku', 'price'] },
                    { 
                        model: RecipeItem, 
                        as: 'ingredients', 
                        include: [{ model: InventoryItem, as: 'inventoryItem' }] 
                    }
                ],
                transaction
            });
        });

        const data = result.data || result;
        res.json({ 
            success: true, 
            data: data, 
            message: "Recipe updated successfully" 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete recipe
 */
exports.deleteRecipe = async (req, res, next) => {
    try {
        const { id } = req.params;
        const business_id = req.business_id || req.businessId;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Recipe, RecipeItem } = models;
            
            const recipe = await Recipe.findOne({ where: { id, businessId: business_id }, transaction });
            if (!recipe) throw createHttpError(404, "Recipe not found");
            
            await RecipeItem.destroy({ where: { recipeId: id }, transaction });
            await recipe.destroy({ transaction });
        });

        res.json({ 
            success: true, 
            message: "Recipe deleted successfully" 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Check availability
 */
exports.checkAvailability = async (req, res, next) => {
    try {
        const { id } = req.params;
        const business_id = req.business_id || req.businessId;
        const { quantity = 1 } = req.query;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Recipe, RecipeItem, InventoryItem } = models;
            
            const recipe = await Recipe.findOne({
                where: { id, businessId: business_id },
                include: [{ 
                    model: RecipeItem, 
                    as: 'ingredients', 
                    include: [{ model: InventoryItem, as: 'inventoryItem' }] 
                }]
            });

            if (!recipe) throw createHttpError(404, "Recipe not found");

            const neededQty = parseInt(quantity);
            const multiplier = neededQty / (recipe.yield || 1);

            const ingredients = recipe.ingredients || [];
            const availability = [];
            let canPrepare = true;
            let maxCanMake = Infinity;

            for (const ing of ingredients) {
                const inventory = ing.inventoryItem;
                const required = ing.quantityRequired * multiplier;
                const available = Number(inventory?.quantity || 0); // Hardened field
                const hasEnough = available >= required;

                if (!hasEnough) canPrepare = false;
                
                const possible = Math.floor(available / (ing.quantityRequired || 1));
                maxCanMake = Math.min(maxCanMake, possible);

                availability.push({
                    ingredientId: ing.id,
                    inventoryId: ing.inventoryItemId,
                    required,
                    available,
                    hasEnough,
                    shortage: hasEnough ? 0 : required - available
                });
            }

            return {
                canPrepare,
                quantity: neededQty,
                canMake: maxCanMake === Infinity ? 0 : maxCanMake,
                canFulfillRequest: maxCanMake >= neededQty,
                ingredients: availability
            };
        });

        const data = result.data || result;
        res.json({ 
            success: true, 
            data: data,
            message: "Recipe availability analysis completed"
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get cost analysis
 */
exports.getCostAnalysis = async (req, res, next) => {
    try {
        const { id } = req.params;
        const business_id = req.business_id || req.businessId;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Recipe, RecipeItem, InventoryItem, Product } = models;
            
            const recipe = await Recipe.findOne({
                where: { id, businessId: business_id },
                include: [
                    { model: Product, as: 'product', attributes: ['id', 'name', 'price'] },
                    { 
                        model: RecipeItem, 
                        as: 'ingredients', 
                        include: [{ 
                            model: InventoryItem, 
                            as: 'inventoryItem'
                        }]
                    }
                ]
            });

            if (!recipe) throw createHttpError(404, "Recipe not found");

            const ingredients = recipe.ingredients || [];
            let totalCost = 0;

            const ingredientCosts = ingredients.map(ing => {
                const unitCost = Number(ing.inventoryItem?.unitCost || 0); // Hardened field
                const cost = unitCost * ing.quantityRequired;
                totalCost += cost;

                return {
                    ingredientId: ing.id,
                    inventoryItemId: ing.inventoryItemId,
                    name: ing.inventoryItem?.name || 'Unknown',
                    quantity: ing.quantityRequired,
                    unit: ing.unit,
                    unitCost,
                    totalCost: Math.round(cost * 100) / 100
                };
            });

            const productPrice = Number(recipe.product?.price || 0);
            const profit = productPrice - totalCost;
            const profitMargin = productPrice > 0 ? (profit / productPrice) * 100 : 0;

            return {
                recipeId: recipe.id,
                name: recipe.name,
                productPrice,
                totalCost: Math.round(totalCost * 100) / 100,
                profit: Math.round(profit * 100) / 100,
                profitMargin: Math.round(profitMargin * 100) / 100,
                yield: recipe.yield || 1
            };
        });

        const data = result.data || result;
        res.json({ 
            success: true, 
            data: data,
            message: "Recipe cost analysis completed"
        });
    } catch (error) {
        next(error);
    }
};
