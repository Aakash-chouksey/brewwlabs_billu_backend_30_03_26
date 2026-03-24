const express = require('express');
const router = express.Router();
const categoryController = require('../../controllers/tenant/category.controller');
const { authorize } = require('../../middlewares/tenantMiddleware');

/**
 * Category Routes
 * Only attaches middleware and calls controller methods.
 */

// All routes here are already protected by app-level tenant middleware
// isVerifiedUser → tenantRoutingMiddleware → tenantOnlyMiddleware → tenantDatabaseGuard

// Get categories: open to all authenticated tenant users
router.get('/', categoryController.getCategories);

// Create category: restricted to BusinessAdmin
router.post('/', authorize(['BusinessAdmin']), categoryController.addCategory);

// Update/Delete: restricted to BusinessAdmin or SUPER_ADMIN (if impersonating)
router.route('/:id')
    .put(authorize(['SUPER_ADMIN', 'BusinessAdmin']), categoryController.updateCategory)
    .delete(authorize(['SUPER_ADMIN', 'BusinessAdmin']), categoryController.deleteCategory);

module.exports = router;
