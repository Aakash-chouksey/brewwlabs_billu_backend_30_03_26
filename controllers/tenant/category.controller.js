const categoryService = require('../../services/tenant/category.service');
const cache = require('../../utils/cache');

/**
 * Category Controller - Neon-Safe Version
 * Standardized for transaction-scoped service access
 */
const categoryController = {
    /**
     * Create a new category
     */
    addCategory: async (req, res, next) => {
        try {
            const { name, description, color, image, isEnabled } = req.body;
            
            const category = await categoryService.addCategory(req, {
                name,
                description,
                color,
                image,
                isEnabled
            });
            
            res.status(201).json({ success: true, data: category });
            
            // Invalidate relevant caches
            const keys = [
                cache.generateKey(req, 'categories'),
                `${cache.generateKey(req, 'products')}:all`,
                cache.generateKey(req, 'product-types')
            ];
            await Promise.all(keys.map(key => cache.del(key)));
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get all categories
     */
    getCategories: async (req, res, next) => {
        try {
            const cacheKey = cache.generateKey(req, 'categories');
            const cached = await cache.get(cacheKey);
            
            if (cached) {
                return res.status(200).json({ success: true, data: cached, _cached: true });
            }

            const categories = await categoryService.getCategories(req);
            await cache.set(cacheKey, categories, 600); // 10 mins

            res.status(200).json({ success: true, data: categories });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Update a category
     */
    updateCategory: async (req, res, next) => {
        try {
            const { id } = req.params;
            const category = await categoryService.updateCategory(req, id, req.body);
            
            res.status(200).json({ success: true, data: category });
            
            // Invalidate relevant caches
            const keys = [
                cache.generateKey(req, 'categories'),
                `${cache.generateKey(req, 'products')}:all`,
                cache.generateKey(req, 'product-types')
            ];
            await Promise.all(keys.map(key => cache.del(key)));
        } catch (error) {
            next(error);
        }
    },

    /**
     * Delete a category
     */
    deleteCategory: async (req, res, next) => {
        try {
            const { id } = req.params;
            await categoryService.deleteCategory(req, id);
            
            res.status(200).json({ success: true, message: "Category deleted successfully" });
            
            // Invalidate relevant caches
            const keys = [
                cache.generateKey(req, 'categories'),
                `${cache.generateKey(req, 'products')}:all`,
                cache.generateKey(req, 'product-types')
            ];
            await Promise.all(keys.map(key => cache.del(key)));
        } catch (error) {
            next(error);
        }
    }
};

module.exports = categoryController;
