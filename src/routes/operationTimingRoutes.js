const express = require('express');
const router = express.Router();
const {
  getOperationTimings,
  createOperationTiming,
  updateOperationTiming,
  deleteOperationTiming
} = require('../controllers/operationTimingController');

// GET /api/tenant/operation-timings - Get all operation timings
router.get('/', getOperationTimings);

// POST /api/tenant/operation-timings - Create operation timing
router.post('/', createOperationTiming);

// PUT /api/tenant/operation-timings/:id - Update operation timing
router.put('/:id', updateOperationTiming);

// DELETE /api/tenant/operation-timings/:id - Delete operation timing
router.delete('/:id', deleteOperationTiming);

module.exports = router;
