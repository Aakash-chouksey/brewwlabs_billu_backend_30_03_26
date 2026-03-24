const express = require('express');
const router = express.Router();
const {
  getTimings,
  createTiming,
  updateTiming,
  deleteTiming
} = require('../controllers/tenant/timingController');

// GET /api/tenant/operation-timings - Get all operation timings
router.get('/', getTimings);

// POST /api/tenant/operation-timings - Create operation timing
router.post('/', createTiming);

// PUT /api/tenant/operation-timings/:id - Update operation timing
router.put('/:id', updateTiming);

// DELETE /api/tenant/operation-timings/:id - Delete operation timing
router.delete('/:id', deleteTiming);

module.exports = router;
