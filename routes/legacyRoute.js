const express = require('express');
const router = express.Router();

const { loginAdmin } = require('../controllers/userController');
const analyticsController = require('../controllers/analyticsController');

// Legacy shim: POST /api/login -> userController.loginAdmin
router.post('/login', loginAdmin);

// Legacy shim: GET /api/avgTicketAgent/:businessId -> analyticsController.getAvgTicketsPerAgent
router.get('/avgTicketAgent/:businessId', analyticsController.getAvgTicketsPerAgent);

module.exports = router;
