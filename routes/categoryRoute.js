const express = require("express");
const {
    addCategory,
    getCategories,
    updateCategory,
    deleteCategory
} = require("../controllers/tenant/category.controller");
const { authorize } = require("../middlewares/tenantMiddleware");
const router = express.Router();

// Middleware is applied at app level: isVerifiedUser → tenantRoutingMiddleware → tenantOnlyMiddleware
// No middleware needed here - routes are already protected

// Get categories is open to all authenticated tenant users (scoped by role in controller)
router.route("/").get(getCategories);

// Create category restricted to Admins
router.route("/").post(authorize(['BusinessAdmin']), addCategory);

router.route("/:id")
    .put(authorize(['SUPER_ADMIN', 'BusinessAdmin']), updateCategory)
    .delete(authorize(['SUPER_ADMIN', 'BusinessAdmin']), deleteCategory);

module.exports = router;
