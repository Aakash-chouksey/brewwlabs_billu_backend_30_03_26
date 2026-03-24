/**
 * NEON-SAFE ARCHITECTURE COMPLIANCE
 * 
 * This controller follows the standardized high-performance architecture:
 * - Models accessed via context.models (READ) or context.transactionModels (WRITE)
 * - req.models is DEPRECATED and blocked by middleware to prevent connection pinning.
 * - All DB calls MUST use req.readWithTenant() or req.executeWithTenant().
 */

const whatsappService = require('../services/whatsappService');

const whatsappController = {
  // API to send a manual message
  sendMessage: async (req, res, next) => {
    try {
      const { to, message } = req.body;
      if (!to || !message) {
        return res.status(400).json({ status: 'fail', message: 'Missing "to" or "message" fields' });
      }

      const response = await whatsappService.sendMessage(to, message);
      
      res.status(200).json({
        status: 'success',
        data: response
      });
    } catch (error) {
      next(error);
    }
  },

  // Webhook for receiving messages (for bot/ordering)
  receiveWebhook: async (req, res, next) => {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      // Verification request
      if (mode && token) {
        if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
          console.log('WEBHOOK_VERIFIED');
          return res.status(200).send(challenge);
        } else {
          return res.status(403).send('Forbidden');
        }
      }

      // Incoming message handling
      if (req.body.object) {
        if (
          req.body.entry &&
          req.body.entry[0].changes &&
          req.body.entry[0].changes[0].value.messages &&
          req.body.entry[0].changes[0].value.messages[0]
        ) {
          const message = req.body.entry[0].changes[0].value.messages[0];
          const from = message.from;
          const msgBody = message.text ? message.text.body : '';

          console.log(`📩 Received WhatsApp message from ${from}: ${msgBody}`);

          // --- BOT LOGIC ---
          const lowerMsg = msgBody.toLowerCase();

          if (lowerMsg.includes('hi') || lowerMsg.includes('hello') || lowerMsg.includes('menu')) {
             await whatsappService.sendMessage(from, "Welcome to My Cafe! 🍔\nReply with:\n1. View Menu\n2. Place Order\n3. Contact Support");
          } else if (lowerMsg === '1') {
             await whatsappService.sendMessage(from, "Here is our menu:\n- Burger: $5\n- Pizza: $8\n- Coffee: $3");
          } else if (lowerMsg === '2') {
             await whatsappService.sendMessage(from, "To place an order, please type the item name.");
          } else {
             await whatsappService.sendMessage(from, "I didn't understand that. Type 'Menu' to see options.");
          }
          // -----------------
        }
        res.sendStatus(200);
      } else {
        res.sendStatus(404);
      }
    } catch (error) {
      next(error);
    }
  },

  // Get WhatsApp service status
  getStatus: async (req, res, next) => {
    try {
      const status = {
        service: 'WhatsApp API',
        configured: !!process.env.WHATSAPP_VERIFY_TOKEN,
        mode: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
      };

      res.status(200).json({
        status: 'success',
        data: status
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = whatsappController;
