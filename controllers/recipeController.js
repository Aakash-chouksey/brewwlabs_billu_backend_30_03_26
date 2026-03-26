/**
 * RECIPE CONTROLLER - Neon-Safe Transaction Pattern
 */

const createHttpError = require("http-errors");
const { Op } = require("sequelize");

/**
 * Get all recipes
 */
exports.getRecipes = async (req, res, next) => {
    try {
        const { businessId } = req;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Recipe, Product } = models;
            
            const recipes = await Recipe.findAll({
                where: { businessId },
                include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'sku'] }],
                order: [['name', 'ASC']]
            });
            
            return recipes || [];
        });

        console.log('[RECIPE CONTROLLER] getRecipes result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result || [];
        res.json({ success: true, data: responseData });
    } catch (error) {
        next(error);
    }
};

/**
 * Get single recipe by ID
 */
exports.getRecipe = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { businessId } = req;

        const recipe = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const recipe = await Recipe.findOne({
                where: { id, businessId },
                include: [
                    { model: Product, as: 'product', attributes: ['id', 'name', 'sku', 'price'] },
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
            return recipe;
        });

        console.log('[RECIPE CONTROLLER] getRecipe result:', JSON.stringify(recipe, null, 2).substring(0, 500));
        
        const responseData = recipe.data || recipe;
        res.json({ success: true, data: responseData });
    } catch (error) {
        next(error);
    }
};

/**
 * Create new recipe
 */
exports.createRecipe = async (req, res, next) => {
    try {
        const { businessId } = req;
        const { name, description, productId, ingredients, instructions, yield: yieldAmount } = req.body;

        if (!name || !productId || !ingredients || !Array.isArray(ingredients)) {
            throw createHttpError(400, "Name, product ID, and ingredients array are required");
        }

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Recipe, RecipeItem, Product } = models;
            
            // Verify product exists
            const product = await Product.findOne({
                where: { id: productId, businessId },
                transaction
            });
            if (!product) throw createHttpError(44, "Product not found");

            // Create recipe
            const recipe = await Recipe.create({
                businessId,
                name,
                description,
                productId,
                instructions: instructions || '',
                yield: yieldAmount || 1
            }, { transaction });

            // Create ingredients
            const ingredientRecords = await Promise.all(
                ingredients.map(async (ing) => {
                    return await RecipeItem.create({
                        recipeId: recipe.id,
                        inventoryItemId: ing.inventoryId,
                        quantityRequired: ing.quantity,
                        unit: ing.unit,
                        notes: ing.notes || ''
                    }, { transaction });
                })
            );

            return { recipe, ingredients: ingredientRecords };
        });

        console.log('[RECIPE CONTROLLER] createRecipe result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.status(201).json({ success: true, data: responseData, message: "Recipe created" });
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
        const { businessId } = req;
        const { name, description, productId, ingredients, instructions, yield: yieldAmount, isActive } = req.body;

        const result = await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Recipe, RecipeItem, Product, InventoryItem } = models;
            
            const recipe = await Recipe.findOne({
                where: { id, businessId },
                transaction
            });
            
            if (!recipe) throw createHttpError(404, "Recipe not found");

            // Update recipe fields
            if (name) recipe.name = name;
            if (description !== undefined) recipe.description = description;
            if (productId) recipe.productId = productId;
            if (instructions !== undefined) recipe.instructions = instructions;
            if (yieldAmount) recipe.yield = yieldAmount;
            if (isActive !== undefined) recipe.isActive = isActive;
            
            await recipe.save({ transaction });

            // Update ingredients if provided
            if (ingredients && Array.isArray(ingredients)) {
                await RecipeItem.destroy({ where: { recipeId: id }, transaction });
                await Promise.all(ingredients.map(ing => 
                    RecipeItem.create({
                        recipeId: id,
                        inventoryItemId: ing.inventoryId,
                        quantityRequired: ing.quantity,
                        unit: ing.unit,
                        notes: ing.notes || ''
                    }, { transaction })
                ));
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

        console.log('[RECIPE CONTROLLER] updateRecipe result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData, message: "Recipe updated" });
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
        const { businessId } = req;

        await req.executeWithTenant(async (context) => {
            const { transaction, transactionModels: models } = context;
            const { Recipe, RecipeItem } = models;
            
            const recipe = await Recipe.findOne({ where: { id, businessId }, transaction });
            if (!recipe) throw createHttpError(404, "Recipe not found");
            
            await RecipeItem.destroy({ where: { recipeId: id }, transaction });
            await recipe.destroy({ transaction });
        });

        res.json({ success: true, message: "Recipe deleted" });
    } catch (error) {
        next(error);
    }
};

/**
 * Check if recipe can be prepared with current inventory
 */
exports.checkAvailability = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { businessId } = req;
        const { quantity = 1 } = req.query;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Recipe, RecipeItem, InventoryItem } = models;
            
            const recipe = await Recipe.findOne({
                where: { id, businessId },
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
                const available = Number(inventory?.currentStock || 0);
                const hasEnough = available >= required;

                if (!hasEnough) canPrepare = false;
                
                const possible = Math.floor(available / ing.quantityRequired);
                maxCanMake = Math.min(maxCanMake, possible);

                availability.push({
                    ingredientId: ing.id,
                    inventoryId: ing.inventoryId,
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
                ingredients: availability,
                missing: availability.filter(a => !a.hasEnough)
            };
        });

        console.log('[RECIPE CONTROLLER] checkAvailability result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData });
    } catch (error) {
        next(error);
    }
};

/**
 * Get recipe cost analysis
 */
exports.getCostAnalysis = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { businessId } = req;

        const result = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Recipe, RecipeItem, InventoryItem, Product } = models;
            
            const recipe = await Recipe.findOne({
                where: { id, businessId },
                include: [
                    { model: Product, as: 'product', attributes: ['id', 'name', 'price'] },
                    { 
                        model: RecipeItem, 
                        as: 'ingredients', 
                        include: [{ 
                            model: InventoryItem, 
                            as: 'inventoryItem', 
                            include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }] 
                        }]
                    }
                ]
            });

            if (!recipe) throw createHttpError(404, "Recipe not found");

            const ingredients = recipe.ingredients || [];
            let totalCost = 0;

            const ingredientCosts = ingredients.map(ing => {
                const unitCost = Number(ing.inventoryItem?.costPerUnit || 0);
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
                ingredients: ingredientCosts,
                yield: recipe.yield
            };
        });

        console.log('[RECIPE CONTROLLER] getCostAnalysis result:', JSON.stringify(result, null, 2).substring(0, 500));
        
        const responseData = result.data || result;
        res.json({ success: true, data: responseData });
    } catch (error) {
        next(error);
    }
};

// Aliases for route compatibility
exports.getRecipeById = exports.getRecipe;
exports.addRecipe = exports.createRecipe;
