const cron = require('node-cron');
const axios = require('axios');

/**
 * Service to keep the Render server alive during business hours.
 * Pings the server every 14 minutes from 8 AM to 12 AM IST.
 * Silently skips if RENDER_EXTERNAL_URL is not set (local dev).
 */
const initKeepAlive = () => {
    const externalUrl = process.env.RENDER_EXTERNAL_URL;

    if (!externalUrl) {
        console.log('ℹ️  RENDER_EXTERNAL_URL not set — keep-alive cron skipped (local dev mode).');
        return;
    }

    // Basic URL validation — prevent ENOTFOUND from a placeholder value
    try {
        const parsed = new URL(externalUrl);
        if (!parsed.hostname || parsed.hostname === 'your-actual-render-url.onrender.com') {
            console.warn('⚠️  RENDER_EXTERNAL_URL looks like a placeholder — keep-alive skipped.');
            return;
        }
    } catch {
        console.warn('⚠️  RENDER_EXTERNAL_URL is not a valid URL — keep-alive skipped.');
        return;
    }

    // Schedule: Every 14 minutes between 8 AM and 11:59 PM IST
    cron.schedule('*/14 8-23 * * *', async () => {
        try {
            console.log(`📡 Pinging server to keep alive: ${externalUrl}/health`);
            const response = await axios.get(`${externalUrl}/health`, { timeout: 10000 });
            console.log(`✅ Keep-alive ping successful. Status: ${response.status}`);
        } catch (error) {
            console.error(`❌ Keep-alive ping failed: ${error.message}`);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });

    console.log(`🕒 Keep-alive cron scheduled for ${externalUrl} (8 AM – 12 AM IST, every 14 mins).`);
};

module.exports = { initKeepAlive };
