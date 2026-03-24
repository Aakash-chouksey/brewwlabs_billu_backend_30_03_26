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

        const recipes = await req.readWithTenant(async (context) => {
            const { transactionModels: models } = context;
            const { Recipe, Product } = models;
            
            return await Recipe.findAll({
                where: { businessId },
                include: [{ model: Product, attributes: ['id', 'name', 'sku'] }],
                order: [['name', 'ASC']]
            });
        });

        res.json({ success: true, data: recipes });
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
            const { Recipe, Product, RecipeIngredient, Inventory } = models;
            
            const recipe = await Recipe.findOne({
                where: { id, businessId },
                include: [
                    { model: Product, attributes: ['id', 'name', 'sku', 'price'] },
                    { 
                        model: RecipeIngredient, 
                        as: 'ingredients', 
                        include: [{ 
                            model: Inventory, 
                            as: 'inventory', 
                            include: [{ model: Product, as: 'product' }] 
                        }]
                    }
                ]
            });

            if (!recipe) throw createHttpError(404, "Recipe not found");
            return recipe;
        });

        res.json({ success: true, data: recipe });
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
            const { Recipe, RecipeIngredient, Product } = models;
            
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
                    return await RecipeIngredient.create({
                        recipeId: recipe.id,
                        inventoryId: ing.inventoryId,
                        quantity: ing.quantity,
                        unit: ing.unit,
                        notes: ing.notes || ''
                    }, { transaction });
                })
            );

            return { recipe, ingredients: ingredientRecords };
        });

        res.status(201).json({ success: true, data: result, message: "Recipe created" });
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
            const { Recipe, RecipeIngredient, Product, Inventory } = models;
            
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
                await RecipeIngredient.destroy({ where: { recipeId: id }, transaction });
                await Promise.all(ingredients.map(ing => 
                    RecipeIngredient.create({
                        recipeId: id,
                        inventoryId: ing.inventoryId,
                        quantity: ing.quantity,
                        unit: ing.unit,
                        notes: ing.notes || ''
                    }, { transaction })
                ));
            }

            return await Recipe.findByPk(id, {
                include: [
                    { model: Product, attributes: ['id', 'name', 'sku', 'price'] },
                    { 
                        model: RecipeIngredient, 
                        as: 'ingredients', 
                        include: [{ model: Inventory, as: 'inventory' }] 
                    }
                ],
                transaction
            });
        });

        res.json({ success: true, data: result, message: "Recipe updated" });
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
            const { Recipe, RecipeIngredient } = models;
            
            const recipe = await Recipe.findOne({ where: { id, businessId }, transaction });
            if (!recipe) throw createHttpError(404, "Recipe not found");
            
            await RecipeIngredient.destroy({ where: { recipeId: id }, transaction });
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
            const { Recipe, RecipeIngredient, Inventory } = models;
            
            const recipe = await Recipe.findOne({
                where: { id, businessId },
                include: [{ 
                    model: RecipeIngredient, 
                    as: 'ingredients', 
                    include: [{ model: Inventory, as: 'inventory' }] 
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
                const inventory = ing.inventory;
                const required = ing.quantity * multiplier;
                const available = Number(inventory?.quantity || 0);
                const hasEnough = available >= required;

                if (!hasEnough) canPrepare = false;
                
                const possible = Math.floor(available / ing.quantity);
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

        res.json({ success: true, data: result });
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
            const { Recipe, RecipeIngredient, Inventory, Product } = models;
            
            const recipe = await Recipe.findOne({
                where: { id, businessId },
                include: [
                    { model: Product, attributes: ['id', 'name', 'price'] },
                    { 
                        model: RecipeIngredient, 
                        as: 'ingredients', 
                        include: [{ 
                            model: Inventory, 
                            as: 'inventory', 
                            include: [{ model: Product, as: 'product', attributes: ['id', 'name'] }] 
                        }]
                    }
                ]
            });

            if (!recipe) throw createHttpError(404, "Recipe not found");

            const ingredients = recipe.ingredients || [];
            let totalCost = 0;

            const ingredientCosts = ingredients.map(ing => {
                const unitCost = Number(ing.inventory?.unitCost || 0);
                const cost = unitCost * ing.quantity;
                totalCost += cost;

                return {
                    ingredientId: ing.id,
                    inventoryId: ing.inventoryId,
                    name: ing.inventory?.product?.name || 'Unknown',
                    quantity: ing.quantity,
                    unit: ing.unit,
                    unitCost,
                    totalCost: Math.round(cost * 100) / 100
                };
            });

            const productPrice = Number(recipe.Product?.price || 0);
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

        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

// Aliases for route compatibility
exports.getRecipeById = exports.getRecipe;
exports.addRecipe = exports.createRecipe;
