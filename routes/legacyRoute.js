const express = require('express');
const router = express.Router();
const { wrapController } = require('../middlewares/safeControllerWrapper');

const userController = wrapController(require('../controllers/tenant/userController'));
const analyticsController = wrapController(require('../controllers/tenant/analyticsController'));

// Legacy shim: POST /api/login -> userController.loginAdmin
router.post('/login', userController.loginAdmin);

// Legacy shim: GET /api/avgTicketAgent/:businessId -> analyticsController.getAvgTicketsPerAgent
router.get('/avgTicketAgent/:businessId', analyticsController.getAvgTicketsPerAgent);

module.exports = router;
