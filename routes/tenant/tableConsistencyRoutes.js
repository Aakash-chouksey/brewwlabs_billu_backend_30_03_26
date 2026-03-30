/**
 * TABLE CONSISTENCY ROUTES
 * API endpoints for table consistency management
 */

const express = require('express');
const router = express.Router();
const tableConsistencyController = require('../../controllers/tenant/tableConsistencyController');

// Run consistency check for all tables
router.post('/check', tableConsistencyController.runConsistencyCheck);

// Get real table status based on active orders
router.get('/:tableId/real-status', tableConsistencyController.getRealTableStatus);

module.exports = router;
