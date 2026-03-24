const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');

// Billing configuration endpoints
// GET /billing/config - Get billing configuration
router.get('/config', billingController.getConfig);

// PUT /billing/config - Update entire billing configuration
router.put('/config', billingController.updateConfig);

// PATCH /billing/config - Partial update of billing configuration
router.patch('/config', billingController.patchConfig);

// Legacy endpoints for backward compatibility
// GET /billing - Get billing configuration (alias)
router.get('/', billingController.getConfig);

// PUT /billing - Update billing configuration (alias)
router.put('/', billingController.updateConfig);

module.exports = router;
