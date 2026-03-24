const express = require("express");
const router = express.Router();

// Middleware is applied at app level: isVerifiedUser → tenantRoutingMiddleware → tenantOnlyMiddleware
// No middleware needed here - routes are already protected
const { getDailySales, getItemWiseSales, getSystemStats } = require("../controllers/reportController");
const { tenantRoutingMiddleware } = require("../middlewares/tenantRouting");

const { authorize } = require("../middlewares/tenantMiddleware");

// Apply auth first

// Admin Global Stats (no tenant models - uses ControlPlane; defined before tenant middleware)
router.get("/admin/stats", authorize(['SUPER_ADMIN']), getSystemStats);

// Tenant routes: daily-sales, item-sales use getModelsForRequest

router.get("/daily-sales", getDailySales);
router.get("/item-sales", getItemWiseSales);

module.exports = router;
