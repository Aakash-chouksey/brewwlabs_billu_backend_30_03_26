const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

router.get('/sales-trends', analyticsController.getSalesTrends);
router.get('/top-products', analyticsController.getTopProducts);
router.get('/peak-hours', analyticsController.getPeakHours);
// Aggregated summary used by pos-admin (e.g., GET /api/analytics/:businessId)
router.get('/:businessId', analyticsController.getSummary);
// Average tickets per agent (matches frontend's /avgTicketAgent/:businessId)
router.get('/avgTicketAgent/:businessId', analyticsController.getAvgTicketsPerAgent);

module.exports = router;
