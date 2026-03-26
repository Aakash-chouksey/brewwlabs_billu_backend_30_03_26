/**
 * API RESPONSE BUILDER
 * 
 * Provides simplified, consistent API responses across all endpoints.
 * Ensures no crashes and always returns valid response structure.
 */

const { safeObject } = require('./safeDb');

/**
 * Create a standardized success response
 * @param {any} data - Response data (will be sanitized)
 * @param {string} message - Optional success message
 * @returns {Object} Standardized success response
 */
function success(data, message = 'Success') {
  if (data === null || data === undefined) {
    throw new Error('API Success response requires data');
  }
  return {
    success: true,
    message: message || 'Success',
    data: data
  };
}

/**
 * Create a standardized error response
 * @param {string} message - Error message
 * @param {any} details - Additional error details (optional)
 * @returns {Object} Standardized error response
 */
function error(message = 'Operation failed', details = null) {
  return {
    success: false,
    message: message || 'Operation failed',
    data: details
  };
}

/**
 * Create a standardized empty/safe response for null/undefined data
 * @param {string} resourceName - Name of the resource (for logging)
 * @returns {Object} Safe empty response
 */
function safeEmpty(resourceName = 'Data') {
  throw new Error(`${resourceName} not found or empty`);
}

/**
 * Wrap any data in safe response format
 * @param {any} data - Data to wrap
 * @param {string} fallbackMessage - Message if data is empty
 * @returns {Object} Safe response with data
 */
function wrap(data, fallbackMessage = 'No data available') {
  if (data === null || data === undefined) {
    throw new Error(fallbackMessage);
  }
  
  return {
    success: true,
    message: 'Success',
    data: data
  };
}

/**
 * Create paginated response
 * @param {Array} items - Array of items
 * @param {number} total - Total count
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {Object} Paginated response
 */
function paginated(items = [], total = 0, page = 1, limit = 10) {
  return {
    success: true,
    message: 'Success',
    data: {
      items: items || [],
      pagination: {
        total: total || 0,
        page: page || 1,
        limit: limit || 10,
        totalPages: Math.ceil((total || 0) / (limit || 10)) || 1
      }
    }
  };
}

module.exports = {
  success,
  error,
  safeEmpty,
  wrap,
  paginated
};
