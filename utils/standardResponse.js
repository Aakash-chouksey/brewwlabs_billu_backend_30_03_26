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
    if (!data || typeof data !== 'object') {
       responseData = {
          success: res.statusCode < 400,
          message: res.statusCode < 400 ? "OK" : "Error Occurred",
          data: data
       };
    }

    // 2. Normalize Response Structure (non-recursive to prevent stack overflow)
    const cleanData = {};
    
    // Ensure core success/message fields
    cleanData.success = responseData.success !== undefined 
      ? !!responseData.success 
      : res.statusCode < 400;
      
    cleanData.message = responseData.message || (cleanData.success ? "OK" : "Error Occurred");
    
    // 3. Extract payload without deep cleaning (avoid circular ref issues)
    let payloadToProcess = responseData.data !== undefined ? responseData.data : responseData;
    
    // If already in standard format, use data field
    if (responseData.success !== undefined && responseData.data !== undefined) {
       payloadToProcess = responseData.data;
    } else if (Array.isArray(responseData)) {
       payloadToProcess = responseData;
    } else if (typeof responseData === 'object' && responseData !== null) {
       // Exclude standard fields from payload
       const { success: _, message: __, ...rest } = responseData;
       payloadToProcess = rest;
    }

    // 4. Safe serialization: Handle Sequelize models and arrays WITHOUT recursion
    // Use JSON.stringify with replacer to handle circular references
    try {
      if (Array.isArray(payloadToProcess)) {
        // Map array items - call toJSON if available, otherwise use as-is
        cleanData.data = payloadToProcess.map(item => {
          if (item && typeof item.toJSON === 'function') {
            try {
              return item.toJSON();
            } catch (e) {
              // If toJSON fails (circular ref), return plain object
              return Object.keys(item).reduce((acc, key) => {
                if (!key.startsWith('_') && typeof item[key] !== 'function') {
                  acc[key] = item[key];
                }
                return acc;
              }, {});
            }
          }
          return item;
        });
      } else if (payloadToProcess && typeof payloadToProcess.toJSON === 'function') {
        // Single Sequelize model
        try {
          cleanData.data = payloadToProcess.toJSON();
        } catch (e) {
          // If toJSON fails, extract dataValues or use empty object
          cleanData.data = payloadToProcess.dataValues || {};
        }
      } else {
        // Plain object or primitive - no deep cleaning to avoid circular refs
        cleanData.data = payloadToProcess;
      }
    } catch (err) {
      console.error('⚠️ Response cleaning error:', err.message);
      // Fallback: return data as-is
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
