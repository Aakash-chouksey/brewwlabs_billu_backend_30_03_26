const axios = require('axios');
const config = require('../config/config'); // Assuming config has WHATSAPP credentials

const whatsappService = {
  // Send a text message
  sendMessage: async (to, body) => {
    try {
      const token = process.env.WHATSAPP_TOKEN;
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

      const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
      
      // Production-safe debug logging
      console.log(`[WhatsApp] POST ${url}`);

      const response = await axios({
        method: 'POST',
        url: url,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: { body: body },
        },
      });
      return response.data;
    } catch (error) {
      console.error('WhatsApp Send Message Error:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
      if (error.response) {
         throw new Error(`WhatsApp API Error: ${error.response.data.error.message}`);
      }
      throw new Error('Failed to send WhatsApp message');
    }
  },

  // Send a template message (e.g., for bills)
  sendTemplateMessage: async (to, templateName, languageCode, components) => {
    try {
      const token = process.env.WHATSAPP_TOKEN;
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

      const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
      
      console.log(`[WhatsApp] POST ${url} (Template: ${templateName})`);

      const response = await axios({
        method: 'POST',
        url: url,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          messaging_product: 'whatsapp',
          to: to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: languageCode },
            components: components,
          },
        },
      });
      return response.data;
    } catch (error) {
      console.error('WhatsApp Template Error:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
       if (error.response) {
         throw new Error(`WhatsApp API Error: ${error.response.data.error.message}`);
      }
      throw new Error('Failed to send WhatsApp template');
    }
  }
};

module.exports = whatsappService;
