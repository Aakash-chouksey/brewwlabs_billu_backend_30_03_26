/**
 * FAIL-SAFE CONTROLLER WRAPPER
 * 
 * Wraps all controller functions with crash protection.
 * Ensures no unhandled errors crash the server.
 */

const { safeNumber, safeArray, safeObject, safeString } = require('./safeDb');
const apiResponse = require('./apiResponse');

/**
 * Wrap a controller function with fail-safe error handling
 * @param {Function} fn - Controller function
 * @param {string} operationName - Name of the operation for logging
 * @returns {Function} Wrapped function
 */
function failSafe(fn, operationName = 'Operation') {
  return async (req, res, next) => {
    try {
      // Validate request object
      if (!req || typeof req !== 'object') {
        console.error(`❌ ${operationName}: Invalid request object`);
        return res.status(200).json(apiResponse.error('Invalid request'));
      }

      // Validate response object
      if (!res || typeof res.json !== 'function') {
        console.error(`❌ ${operationName}: Invalid response object`);
        return;
      }

      // Execute the controller function
      const result = await fn(req, res, next);
      
      // If function returns a value and response hasn't been sent, send it
      if (result !== undefined && !res.headersSent) {
        return res.status(200).json(apiResponse.success(result));
      }
      
      return result;
    } catch (error) {
      // Log the error safely
      console.error(`❌ ${operationName} FAILED:`, {
        message: safeString(error?.message),
        path: safeString(req?.originalUrl),
        method: safeString(req?.method),
        timestamp: new Date().toISOString()
      });

      // Always return a safe response
      if (!res.headersSent) {
        return res.status(200).json(apiResponse.error(
          process.env.NODE_ENV === 'development' 
            ? safeString(error?.message) 
            : 'Operation failed safely'
        ));
      }
    }
  };
}

/**
 * Wrap all exports of a controller module
 * @param {Object} controller - Controller module exports
 * @param {string} controllerName - Name for logging
 * @returns {Object} Wrapped controller
 */
function wrapController(controller, controllerName = 'Controller') {
  const wrapped = {};
  
  for (const [key, value] of Object.entries(controller)) {
    if (typeof value === 'function') {
      wrapped[key] = failSafe(value, `${controllerName}.${key}`);
    } else {
      wrapped[key] = value;
    }
  }
  
  return wrapped;
}

/**
 * Safe async handler - wrapper for Express async functions
 * @param {Function} fn - Async function
 * @returns {Function} Express middleware
 */
function safeAsync(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next))
      .catch((error) => {
        console.error('❌ SafeAsync Error:', safeString(error?.message));
        
        if (!res.headersSent) {
          res.status(200).json(apiResponse.error('Request handled safely'));
        }
      });
  };
}

/**
 * Safe array operation wrapper
 * Prevents crashes from .map(), .filter(), .reduce() on null/undefined
 * @param {any} arr - Array or array-like object
 * @param {Function} operation - Operation to perform
 * @param {any} fallback - Fallback value if operation fails
 * @returns {any} Result or fallback
 */
function safeArrayOperation(arr, operation, fallback = []) {
  const safeArr = safeArray(arr, []);
  try {
    return operation(safeArr);
  } catch (error) {
    console.error('❌ Array operation failed:', safeString(error?.message));
    return fallback;
  }
}

/**
 * Safe object property access
 * Prevents crashes from accessing properties on null/undefined
 * @param {any} obj - Object
 * @param {string} prop - Property name
 * @param {any} fallback - Fallback value
 * @returns {any} Property value or fallback
 */
function safeProp(obj, prop, fallback = null) {
  if (!obj || typeof obj !== 'object') {
    return fallback;
  }
  return obj[prop] !== undefined ? obj[prop] : fallback;
}

/**
 * Safe database result handler
 * Ensures database results are always safe to work with
 * @param {any} result - Database result
 * @param {string} type - Expected type: 'array', 'object', 'number', 'string'
 * @param {any} fallback - Fallback value
 * @returns {any} Safe result
 */
function safeDbResult(result, type = 'object', fallback = null) {
  if (result === null || result === undefined) {
    console.warn(`⚠️ Database returned null/undefined, using fallback`);
    return fallback;
  }

  switch (type) {
    case 'array':
      return safeArray(result, fallback || []);
    case 'object':
      return safeObject(result, fallback || {});
    case 'number':
      return safeNumber(result, fallback || 0);
    case 'string':
      return safeString(result, fallback || '');
    default:
      return result;
  }
}

/**
 * Build safe where clause for queries
 * Prevents undefined values in where clauses
 * @param {Object} clause - Where clause object
 * @returns {Object} Safe where clause
 */
function safeWhereClause(clause = {}) {
  const safe = {};
  
  for (const [key, value] of Object.entries(clause)) {
    // Skip undefined or null values
    if (value === undefined || value === null) {
      console.warn(`⚠️ Skipping undefined/null value for key: ${key}`);
      continue;
    }
    
    // Skip empty strings for ID fields
    if (typeof value === 'string' && value.trim() === '' && 
        (key.includes('Id') || key.includes('ID'))) {
      console.warn(`⚠️ Skipping empty ID for key: ${key}`);
      continue;
    }
    
    safe[key] = value;
  }
  
  return safe;
}

module.exports = {
  failSafe,
  wrapController,
  safeAsync,
  safeArrayOperation,
  safeProp,
  safeDbResult,
  safeWhereClause
};
