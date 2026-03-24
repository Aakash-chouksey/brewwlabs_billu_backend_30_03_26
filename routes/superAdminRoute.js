const express = require("express");
const superAdminController = require("../controllers/superAdminController");
const { isVerifiedUser, adminOnlyMiddleware } = require("../middlewares/tokenVerification");
const { adminDatabaseGuard } = require("../middlewares/databaseIsolation");

const router = express.Router();

// 🟢 Phase 5: Production-Ready Super Admin APIs
router.use(isVerifiedUser);
router.use(adminOnlyMiddleware);
router.use(adminDatabaseGuard);

/**
 * 🧱 TENANT MANAGEMENT
 */
// GET /admin/tenants - List all registered tenants
router.get("/tenants", superAdminController.getAllTenants);

// GET /admin/tenants/:tenantId - Detailed info for a specific tenant
router.get("/tenants/:tenantId", superAdminController.getTenantDetails);

// PATCH /admin/tenants/:tenantId/status - Suspend/Activate tenant
router.patch("/tenants/:tenantId/status", superAdminController.updateTenantStatus);

/**
 * 🔍 CROSS-TENANT DATA ACCESS (SAFE SCOPED)
 */
// GET /admin/tenants/:tenantId/orders - Access orders for a specific tenant (Scoped)
router.get("/tenants/:tenantId/orders", superAdminController.getTenantOrders);

/**
 * 📈 SYSTEM MONITORING & METRICS
 */
// GET /admin/metrics - Global system performance and aggregation
router.get("/metrics", superAdminController.getSystemMetrics);

module.exports = router;
