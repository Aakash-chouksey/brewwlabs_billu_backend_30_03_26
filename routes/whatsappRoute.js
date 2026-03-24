const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

// Send message (Protected)
router.post('/send', whatsappController.sendMessage);

// Webhook (Public, verified by token)
router.get('/webhook', whatsappController.receiveWebhook);
router.post('/webhook', whatsappController.receiveWebhook);

module.exports = router;
