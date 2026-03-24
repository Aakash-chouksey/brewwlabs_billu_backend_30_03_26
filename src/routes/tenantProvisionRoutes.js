const express = require('express');
const router = express.Router();
const tenantProvisionController = require('../controllers/tenantProvisionController');
const { authenticateSuperAdmin } = require('../middleware/auth');

// Apply super admin authentication to all tenant provisioning routes
router.use(authenticateSuperAdmin);

/**
 * @route   POST /api/admin/tenants
 * @desc    Provision a new tenant
 * @access  Super Admin
 */
router.post('/', tenantProvisionController.provisionTenant);

/**
 * @route   GET /api/admin/tenants
 * @desc    List all tenants with optional filtering
 * @access  Super Admin
 * @query   status - Filter by status (active, inactive, suspended, pending)
 * @query   type - Filter by type (SOLO, MASTER_FRANCHISE, FRANCHISE, SUB_FRANCHISE)
 * @query   page - Page number for pagination
 * @query   limit - Number of items per page
 */
router.get('/', tenantProvisionController.listTenants);

/**
 * @route   GET /api/admin/tenants/:brandId
 * @desc    Get tenant details and statistics
 * @access  Super Admin
 */
router.get('/:brandId', tenantProvisionController.getTenant);

/**
 * @route   POST /api/admin/tenants/:brandId/test-connection
 * @desc    Test tenant database connection
 * @access  Super Admin
 */
router.post('/:brandId/test-connection', tenantProvisionController.testConnection);

/**
 * @route   PUT /api/admin/tenants/:brandId/status
 * @desc    Update tenant status
 * @access  Super Admin
 * @body    { status: "active" | "inactive" | "suspended" | "pending" }
 */
router.put('/:brandId/status', tenantProvisionController.updateStatus);

/**
 * @route   DELETE /api/admin/tenants/:brandId
 * @desc    Deactivate tenant
 * @access  Super Admin
 */
router.delete('/:brandId', tenantProvisionController.deactivateTenant);

/**
 * @route   GET /api/admin/tenants/:brandId/health
 * @desc    Get tenant health metrics
 * @access  Super Admin
 */
router.get('/:brandId/health', tenantProvisionController.getTenantHealth);

/**
 * @route   GET /api/admin/tenants/:brandId/migrations
 * @desc    Get tenant migration logs
 * @access  Super Admin
 * @query   page - Page number for pagination
 * @query   limit - Number of items per page
 */
router.get('/:brandId/migrations', tenantProvisionController.getMigrationLogs);

/**
 * @route   GET /api/admin/tenants/:brandId/usage
 * @desc    Get tenant usage statistics
 * @access  Super Admin
 */
router.get('/:brandId/usage', tenantProvisionController.getTenantUsage);

module.exports = router;
