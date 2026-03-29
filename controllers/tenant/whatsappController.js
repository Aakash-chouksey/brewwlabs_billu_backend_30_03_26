/**
 * WHATSAPP CONTROLLER - Neon-Safe Version
 * Standardized for transaction-scoped service access and consistent multi-tenancy.
 */

const whatsappService = require('../../services/whatsappService');

const whatsappController = {
  /**
   * Send a manual message
   */
  sendMessage: async (req, res, next) => {
    try {
      const { to, message } = req.body;
      if (!to || !message) {
        return res.status(400).json({ success: false, message: 'Missing "to" or "message" fields' });
      }

      const response = await whatsappService.sendMessage(to, message);
      
      res.status(200).json({
        success: true,
        data: response,
        message: "Message sent successfully"
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Webhook for receiving messages
   */
  receiveWebhook: async (req, res, next) => {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      // Verification request
      if (mode && token) {
        if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
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

          // Simple bot logic
          const lowerMsg = msgBody.toLowerCase();
          if (lowerMsg.includes('hi') || lowerMsg.includes('hello') || lowerMsg.includes('menu')) {
             await whatsappService.sendMessage(from, "Welcome! 🍔\nReply with:\n1. View Menu\n2. Place Order\n3. Contact Support");
          }
        }
        res.sendStatus(200);
      } else {
        res.sendStatus(404);
      }
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get WhatsApp service status
   */
  getStatus: async (req, res, next) => {
    try {
      const status = {
        service: 'WhatsApp API',
        configured: !!process.env.WHATSAPP_VERIFY_TOKEN,
        mode: process.env.NODE_ENV || 'production',
        timestamp: new Date().toISOString()
      };

      res.status(200).json({
        success: true,
        data: status,
        message: "WhatsApp service status retrieved"
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = whatsappController;
