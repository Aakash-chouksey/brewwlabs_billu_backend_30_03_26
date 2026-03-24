const express = require('express');
const router = express.Router();
const { sendVerificationCode } = require('../services/smsService');

// POST /api/sms/send-code
router.post('/send-code', async (req, res) => {
  try {
    const { phone, serviceName, expirationSeconds } = req.body || {};
    if (!phone) return res.status(400).json({ success: false, message: 'phone required' });

    const result = await sendVerificationCode({ phone, serviceName, expirationSeconds });
    if (result.success) return res.status(200).json({ success: true, data: result.data });
    return res.status(result.status || 502).json({ success: false, message: result.message || 'SMS provider error', data: result.data });
  } catch (error) {
    console.error('[smsRoute] Error:', error && (error.message || error));
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Unable to send SMS' });
  }
});

module.exports = router;
