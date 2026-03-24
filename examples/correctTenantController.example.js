/**
 * Example Corrected Tenant Controller
 * 
 * This demonstrates the correct pattern for tenant controllers
 * using req.tenantModels instead of global model imports.
 */

const createHttpError = require("http-errors");

// ❌ INCORRECT - Don't do this:
// const { Category } = require('../models/categoryModel');
// const { Product } = require('../models/productModel');

// ✅ CORRECT - Use tenant models from request:
const getCorrectCategoryController = () => {
    const getCategory = async (req, res, next) => {
        try {
            // ✅ CORRECT: Get models from request context
            const { Category } = req.tenantModels;
            
            const { businessId } = req.auth;
            const { outletId } = req.query;
            
            // Build query with tenant isolation
            const where = { businessId };
            if (outletId) {
                where.outletId = outletId;
            }
            
            // ✅ CORRECT: Use tenant-specific model
            const categories = await Category.findAll({
                where,
                order: [['name', 'ASC']]
            });
            
            res.json({
                success: true,
                data: categories,
                count: categories.length
            });
            
        } catch (error) {
            console.error('Category controller error:', error);
            next(createHttpError(500, "Failed to fetch categories"));
        }
    };

    const createCategory = async (req, res, next) => {
        try {
            // ✅ CORRECT: Get models from request context
            const { Category } = req.tenantModels;
            
            const { name, description, color } = req.body;
            const { businessId } = req.auth;
            const { outletId } = req.query;
            
            // ✅ CORRECT: Create with tenant context
            const category = await Category.create({
                name,
                description,
                color,
                businessId, // From authenticated user
                outletId: outletId || null,
                isEnabled: true,
                sortOrder: 0
            });
            
            res.status(201).json({
                success: true,
                data: category
            });
            
        } catch (error) {
            console.error('Category creation error:', error);
            next(createHttpError(500, "Failed to create category"));
        }
    };

    const updateCategory = async (req, res, next) => {
        try {
            // ✅ CORRECT: Get models from request context
            const { Category } = req.tenantModels;
            
            const { id } = req.params;
            const { name, description, color, isEnabled } = req.body;
            const { businessId } = req.auth;
            
            // ✅ CORRECT: Find and update with tenant isolation
            const category = await Category.findOne({
                where: { id, businessId } // Ensures tenant isolation
            });
            
            if (!category) {
                return next(createHttpError(404, "Category not found"));
            }
            
            await category.update({
                name,
                description,
                color,
                isEnabled
            });
            
            res.json({
                success: true,
                data: category
            });
            
        } catch (error) {
            console.error('Category update error:', error);
            next(createHttpError(500, "Failed to update category"));
        }
    };

    const deleteCategory = async (req, res, next) => {
        try {
            // ✅ CORRECT: Get models from request context
            const { Category } = req.tenantModels;
            
            const { id } = req.params;
            const { businessId } = req.auth;
            
            // ✅ CORRECT: Find and delete with tenant isolation
            const category = await Category.findOne({
                where: { id, businessId } // Ensures tenant isolation
            });
            
            if (!category) {
                return next(createHttpError(404, "Category not found"));
            }
            
            await category.destroy();
            
            res.json({
                success: true,
                message: "Category deleted successfully"
            });
            
        } catch (error) {
            console.error('Category deletion error:', error);
            next(createHttpError(500, "Failed to delete category"));
        }
    };

    return {
        getCategory,
        createCategory,
        updateCategory,
        deleteCategory
    };
};

module.exports = getCorrectCategoryController();
