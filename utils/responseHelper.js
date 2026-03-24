/**
 * STANDARDIZED RESPONSE HELPER
 * 
 * Provides consistent response formatting across all API endpoints
 * Ensures uniform structure and error handling
 */

/**
 * Create a standard success response
 * @param {boolean} success - Success status
 * @param {string} message - Response message
 * @param {any} data - Response data (object, array, or null)
 * @param {number} statusCode - HTTP status code (default: 200)
 * @returns {Object} Standardized response object
 */
const createResponse = (success, message, data = null, statusCode = 200) => {
    return {
        success,
        message,
        data
    };
};

/**
 * Create a standard paginated response
 * @param {boolean} success - Success status
 * @param {string} message - Response message
 * @param {any} data - Response data
 * @param {Object} pagination - Pagination metadata
 * @param {number} statusCode - HTTP status code (default: 200)
 * @returns {Object} Standardized paginated response
 */
const createPaginatedResponse = (success, message, data, pagination, statusCode = 200) => {
    return {
        success,
        message,
        data,
        pagination
    };
};

/**
 * Create a standard error response
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 400)
 * @param {any} details - Additional error details
 * @returns {Object} Standardized error response
 */
const createErrorResponse = (message, statusCode = 400, details = null) => {
    return {
        success: false,
        message,
        details
    };
};

/**
 * Create a validation error response
 * @param {Array|string} errors - Validation errors
 * @param {number} statusCode - HTTP status code (default: 400)
 * @returns {Object} Standardized validation error response
 */
const createValidationErrorResponse = (errors, statusCode = 400) => {
    const message = Array.isArray(errors) ? errors.join(', ') : errors;
    return {
        success: false,
        message: `Validation failed: ${message}`,
        errors: Array.isArray(errors) ? errors : [errors]
    };
};

/**
 * Create a not found error response
 * @param {string} resource - Resource name (default: 'Resource')
 * @returns {Object} Standardized not found response
 */
const createNotFoundResponse = (resource = 'Resource') => {
    return {
        success: false,
        message: `${resource} not found`,
        error: 'NOT_FOUND'
    };
};

/**
 * Create an access denied error response
 * @param {string} message - Custom message (default: 'Access denied')
 * @returns {Object} Standardized access denied response
 */
const createAccessDeniedResponse = (message = 'Access denied') => {
    return {
        success: false,
        message,
        error: 'ACCESS_DENIED'
    };
};

/**
 * Create a conflict error response (for duplicates, etc.)
 * @param {string} message - Conflict message
 * @param {string} errorType - Error type (default: 'CONFLICT')
 * @returns {Object} Standardized conflict response
 */
const createConflictResponse = (message, errorType = 'CONFLICT') => {
    return {
        success: false,
        message,
        error: errorType
    };
};

/**
 * Send standardized response with proper HTTP status
 * @param {Object} res - Express response object
 * @param {Object} response - Response object from helper functions
 * @param {number} statusCode - HTTP status code
 */
const sendResponse = (res, response, statusCode = 200) => {
    res.status(statusCode).json(response);
};

/**
 * Send success response (shortcut)
 * @param {Object} res - Express response object
 * @param {string} message - Success message
 * @param {any} data - Response data
 * @param {number} statusCode - HTTP status code (default: 200)
 */
const sendSuccess = (res, message, data = null, statusCode = 200) => {
    sendResponse(res, createResponse(true, message, data), statusCode);
};

/**
 * Send paginated response (shortcut)
 * @param {Object} res - Express response object
 * @param {string} message - Response message
 * @param {any} data - Response data
 * @param {Object} pagination - Pagination metadata
 * @param {number} statusCode - HTTP status code (default: 200)
 */
const sendPaginated = (res, message, data, pagination, statusCode = 200) => {
    sendResponse(res, createPaginatedResponse(true, message, data, pagination), statusCode);
};

/**
 * Send error response (shortcut)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 400)
 * @param {any} details - Additional error details
 */
const sendError = (res, message, statusCode = 400, details = null) => {
    sendResponse(res, createErrorResponse(message, statusCode, details), statusCode);
};

/**
 * Send validation error response (shortcut)
 * @param {Object} res - Express response object
 * @param {Array|string} errors - Validation errors
 * @param {number} statusCode - HTTP status code (default: 400)
 */
const sendValidationError = (res, errors, statusCode = 400) => {
    sendResponse(res, createValidationErrorResponse(errors), statusCode);
};

/**
 * Send not found response (shortcut)
 * @param {Object} res - Express response object
 * @param {string} resource - Resource name
 * @param {number} statusCode - HTTP status code (default: 404)
 */
const sendNotFound = (res, resource = 'Resource', statusCode = 404) => {
    sendResponse(res, createNotFoundResponse(resource), statusCode);
};

/**
 * Send access denied response (shortcut)
 * @param {Object} res - Express response object
 * @param {string} message - Custom message
 * @param {number} statusCode - HTTP status code (default: 403)
 */
const sendAccessDenied = (res, message = 'Access denied', statusCode = 403) => {
    sendResponse(res, createAccessDeniedResponse(message), statusCode);
};

/**
 * Send conflict response (shortcut)
 * @param {Object} res - Express response object
 * @param {string} message - Conflict message
 * @param {number} statusCode - HTTP status code (default: 409)
 */
const sendConflict = (res, message, statusCode = 409) => {
    sendResponse(res, createConflictResponse(message), statusCode);
};

module.exports = {
    // Core helpers
    createResponse,
    createPaginatedResponse,
    createErrorResponse,
    createValidationErrorResponse,
    createNotFoundResponse,
    createAccessDeniedResponse,
    createConflictResponse,
    
    // Send helpers
    sendResponse,
    sendSuccess,
    sendPaginated,
    sendError,
    sendValidationError,
    sendNotFound,
    sendAccessDenied,
    sendConflict
};
