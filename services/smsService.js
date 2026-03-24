const axios = require('axios');

const DEFAULT_HOST = 'textflow-sms-api.p.rapidapi.com';
const DEFAULT_URL = 'https://textflow-sms-api.p.rapidapi.com/send-code';

function isValidE164(phone) {
  return typeof phone === 'string' && /^\+\d{8,15}$/.test(phone);
}

function maskKey(key) {
  if (!key || key.length < 6) return '******';
  return `${key.slice(0, 4)}...${key.slice(-2)}`;
}

async function sendVerificationCode({ phone, serviceName = 'Service', expirationSeconds = 60, timeoutMs = 8000, retries = 2 }) {
  if (!isValidE164(phone)) {
    const err = new Error('Invalid phone number. Expecting E.164 format (e.g., +1234567890).');
    err.status = 400;
    throw err;
  }

  const rapidapiKey = process.env.RAPIDAPI_KEY;
  const rapidapiHost = process.env.RAPIDAPI_HOST || DEFAULT_HOST;
  const url = process.env.SMS_API_URL || DEFAULT_URL;
  const providerApiKey = process.env.SMS_PROVIDER_API_KEY || '';

  if (!rapidapiKey) {
    const err = new Error('Server configuration error: RAPIDAPI_KEY is not set.');
    err.status = 500;
    throw err;
  }

  const payload = {
    data: {
      phone_number: phone,
      service_name: serviceName,
      expiration_time: String(expirationSeconds),
      api_key: providerApiKey
    }
  };

  const headers = {
    'x-rapidapi-key': rapidapiKey,
    'x-rapidapi-host': rapidapiHost,
    'Content-Type': 'application/json'
  };

  let attempt = 0;
  let lastError = null;

  while (attempt <= retries) {
    try {
      const response = await axios.request({
        method: 'POST',
        url,
        headers,
        data: payload,
        timeout: timeoutMs,
        validateStatus: (status) => status >= 200 && status < 500
      });

      if (response.status >= 200 && response.status < 300) {
        return {
          success: true,
          status: response.status,
          data: response.data
        };
      }

      if (response.status >= 400 && response.status < 500) {
        return {
          success: false,
          status: response.status,
          data: response.data,
          message: response.data?.message || 'Client error from SMS API'
        };
      }

      lastError = new Error(`Unexpected status ${response.status}`);
      lastError.response = response;
      throw lastError;
    } catch (error) {
      lastError = error;
      attempt += 1;
      const isLast = attempt > retries;
      try {
        const keyPreview = maskKey(rapidapiKey);
        console.error(`[smsService] attempt ${attempt} failed. host=${rapidapiHost} url=${url} rapidapiKey=${keyPreview} willRetry=${!isLast}`);
      } catch (logErr) {
        console.error('[smsService] attempt failed (unable to log details)', logErr);
      }

      if (isLast) break;
      const backoffMs = 500 * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  const error = new Error('Failed to send SMS after retries.');
  error.cause = lastError;
  error.status = 502;
  throw error;
}

module.exports = { sendVerificationCode };
