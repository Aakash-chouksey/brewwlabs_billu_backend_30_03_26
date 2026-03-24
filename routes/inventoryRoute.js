const express = require("express");
const { addStock, getInventory } = require("../controllers/inventoryController");
const { tenantRoutingMiddleware } = require("../middlewares/tenantRouting");

const { authorize } = require("../middlewares/tenantMiddleware");
const router = express.Router();

// Middleware is applied at app level: isVerifiedUser → tenantRoutingMiddleware → tenantOnlyMiddleware
// No middleware needed here - routes are already protected

router.route("/").post(authorize(['SUPER_ADMIN', 'BusinessAdmin', 'Manager']), addStock).get(getInventory);

module.exports = router;
