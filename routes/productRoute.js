const express = require("express");
const { addProduct, getProducts, updateProduct, deleteProduct } = require("../controllers/productController");
const { authorize } = require("../middlewares/tenantMiddleware");
const router = express.Router();

// Middleware is applied at app level: isVerifiedUser → tenantRoutingMiddleware → tenantOnlyMiddleware
// No middleware needed here - routes are already protected

const upload = require("../middlewares/uploadMiddleware");

router.route("/")
    .post(authorize(['SUPER_ADMIN', 'BusinessAdmin', 'Manager']), upload.single("image"), addProduct)
    .get(getProducts);

router.route("/:id")
    .put(authorize(['SUPER_ADMIN', 'BusinessAdmin', 'Manager']), upload.single("image"), updateProduct)
    .delete(authorize(['SUPER_ADMIN', 'BusinessAdmin', 'Manager']), deleteProduct);

module.exports = router;
