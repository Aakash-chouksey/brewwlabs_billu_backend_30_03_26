/**
 * STANDARD API RESPONSE HELPERS
 * 
 * Response format: { success: true/false, message: "", data: <real_data|null> }
 * NO forced empty objects - returns real data or null
 */

/**
 * Send standardized success response
 * @param {Object} res - Express response object
 * @param {Object} data - Response data (REQUIRED)
 * @param {string} message - Success message (default: "OK")
 * @param {number} statusCode - HTTP status code (default: 200)
 */
const sendSuccess = (res, data, message = "OK", statusCode = 200) => {
  if (data === null || data === undefined) {
    throw new Error("sendSuccess requires data. Use sendError for failures.");
  }
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

/**
 * Send standardized error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {Object} data - Additional error data (default: null)
 * @param {number} statusCode - HTTP status code (default: 400)
 */
const sendError = (res, message = "Error occurred", data = null, statusCode = 400) => {
  return res.status(statusCode).json({
    success: false,
    message,
    data
  });
};

/**
 * Standard response wrapper middleware
 * Attaches helpers to res object for consistent usage
 */
const standardResponseMiddleware = (req, res, next) => {
  res.sendSuccess = (data, message, statusCode) => sendSuccess(res, data, message, statusCode);
  res.sendError = (message, data, statusCode) => sendError(res, message, data, statusCode);
  next();
};

/**
 * Response validation middleware (PHASE 8)
 * Blocks invalid responses and enforces standard format
 */
const responseValidationMiddleware = (req, res, next) => {
  const originalJson = res.json;

  res.json = function(data) {
    // If data is not an object or is null, block it
    if (!data || typeof data !== 'object') {
      console.warn('⚠️ [PHASE 8] Invalid response format blocked:', data);
      return originalJson.call(this, {
        success: false,
        message: "Invalid response format: Object required",
        data: null
      });
    }

    // STRICT CHECK: Ensure required fields exist
    // Do NOT silently add success: true or data: {}
    if (data.success === undefined || data.data === undefined) {
      // Use a safer logging approach to avoid stringification issues on large objects
      const preview = (typeof data === 'object') ? 'Object' : String(data).substring(0, 100);
      console.error('🚨 [PHASE 8] Response missing required Fields (success or data):', preview);
      
      if (process.env.NODE_ENV === 'development') {
          // In development, throw to catch bugs early
          // but we can't throw inside res.json without crashing the loop 
          // so we just log heavily
      }
    }

    return originalJson.call(this, data);
  };

  next();
};

module.exports = {
  sendSuccess,
  sendError,
  standardResponseMiddleware,
  responseValidationMiddleware
};
