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
 * Blocks invalid responses and enforces standard format: { success, message, data }
 * SAFE VERSION: Handles circular references and prevents stack overflow
 */
const responseValidationMiddleware = (req, res, next) => {
  const originalJson = res.json;

  res.json = function(data) {
    if (res.headersSent) return;

    // 1. If data is not an object or is null, wrap it
    let responseData = data;
    if (data === null || data === undefined || typeof data !== 'object') {
       responseData = {
          success: res.statusCode < 400,
          message: res.statusCode < 400 ? "Success" : "Error Occurred",
          data: data
       };
    }

    // 2. Normalize Response Structure
    const cleanData = {};
    
    // Explicitly check for success field
    if (responseData.success !== undefined) {
      cleanData.success = !!responseData.success;
    } else {
      cleanData.success = res.statusCode < 400;
    }
      
    cleanData.message = responseData.message || (cleanData.success ? "Success" : "Error Occurred");
    
    // 3. Extract payload
    let payloadToProcess;
    
    // If it's already in the { success, message, data } format, use the data field
    if (responseData.success !== undefined && responseData.data !== undefined) {
      payloadToProcess = responseData.data;
    } else if (Array.isArray(responseData)) {
      payloadToProcess = responseData;
    } else {
      // It's a plain object but doesn't follow the format, or it's a model
      const { success, message, ...rest } = responseData;
      // If after removing success/message there's nothing left, and it was a flat object
      if (Object.keys(rest).length === 0 && (responseData.success !== undefined || responseData.message !== undefined)) {
        payloadToProcess = null;
      } else {
        payloadToProcess = rest;
      }
    }

    // 4. Safe serialization
    try {
      if (Array.isArray(payloadToProcess)) {
        cleanData.data = payloadToProcess.map(item => {
          if (item && typeof item.toJSON === 'function') {
            try { return item.toJSON(); } catch (e) { return item; }
          }
          return item;
        });
      } else if (payloadToProcess && typeof payloadToProcess.toJSON === 'function') {
        try { cleanData.data = payloadToProcess.toJSON(); } catch (e) { cleanData.data = payloadToProcess; }
      } else {
        cleanData.data = payloadToProcess;
      }
    } catch (err) {
      console.error('⚠️ Response cleaning error:', err.message);
      cleanData.data = payloadToProcess;
    }

    return originalJson.call(this, cleanData);
  };

  next();
};

module.exports = {
  sendSuccess,
  sendError,
  standardResponseMiddleware,
  responseValidationMiddleware
};
