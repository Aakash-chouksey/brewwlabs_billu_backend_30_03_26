/**
 * WASTAGE ROUTES
 * Maps to frontend API calls from WastageManagement.jsx
 */

const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

// GET /api/tenant/inventory/wastage
router.get('/wastage', inventoryController.getWastage);

// POST /api/tenant/inventory/wastage
router.post('/wastage', inventoryController.addWastage);

module.exports = router;
