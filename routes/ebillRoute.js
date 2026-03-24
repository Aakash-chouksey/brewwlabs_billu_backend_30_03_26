const express = require('express');
const router = express.Router();
const ebillController = require('../controllers/ebillController');

// Generate E-Bill
router.post('/:orderId/generate', ebillController.generateEBill);
router.post('/:orderId/send-whatsapp', ebillController.sendBillViaWhatsApp);

module.exports = router;
