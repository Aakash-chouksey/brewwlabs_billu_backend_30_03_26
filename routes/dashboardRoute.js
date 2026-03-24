const express = require("express");
const { getDashboardStats } = require("../controllers/dashboardController");
const { tenantRoutingMiddleware } = require("../middlewares/tenantRouting");

const router = express.Router();

// Middleware is applied at app level: isVerifiedUser → tenantRoutingMiddleware → tenantOnlyMiddleware
// No middleware needed here - routes are already protected

router.get("/stats", getDashboardStats);

module.exports = router;
