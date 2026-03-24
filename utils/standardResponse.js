/**
 * STANDARD API RESPONSE HELPERS
 * 
 * PHASE 4: FORCE STANDARD RESPONSE FORMAT
 * ALL APIs MUST return: { success: true/false, message: "", data: {} }
 */

/**
 * Send standardized success response
 * @param {Object} res - Express response object
 * @param {Object} data - Response data (default: {})
 * @param {string} message - Success message (default: "OK")
 * @param {number} statusCode - HTTP status code (default: 200)
 */
const sendSuccess = (res, data = {}, message = "OK", statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data: data || {}
  });
};

/**
 * Send standardized error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {Object} data - Additional error data (default: {})
 * @param {number} statusCode - HTTP status code (default: 400)
 */
const sendError = (res, message = "Error occurred", data = {}, statusCode = 400) => {
  return res.status(statusCode).json({
    success: false,
    message,
    data: data || {}
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
    // If data is not an object or is null, create standard error response
    if (!data || typeof data !== 'object') {
      console.warn('⚠️ [PHASE 8] Invalid response blocked:', data);
      return originalJson.call(this, {
        success: false,
        message: "Invalid response format",
        data: {}
      });
    }

    // Ensure required fields exist while preserving ALL original fields
    if (data.success === undefined) {
      data.success = true;
    }
    if (!data.message) {
      data.message = 'OK';
    }
    if (!data.data) {
      data.data = {};
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
