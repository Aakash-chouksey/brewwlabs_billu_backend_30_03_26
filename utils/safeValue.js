/**
 * SAFE VALUE HELPER (Phase 4 - GLOBAL NULL SAFETY)
 * Prevents crashes from undefined/null values across the entire codebase
 */

/**
 * Safely return value or fallback
 * @param {*} value - The potentially unsafe value
 * @param {*} fallback - Fallback if value is null/undefined/NaN
 * @returns {*} - Safe value
 */
const safe = (value, fallback = null) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number' && isNaN(value)) return fallback;
  return value;
};

/**
 * Safely get nested property
 * @param {Object} obj - Object to traverse
 * @param {string} path - Dot-notation path ('user.profile.name')
 * @param {*} fallback - Fallback value
 * @returns {*} - Safe value at path
 */
const safeGet = (obj, path, fallback = null) => {
  if (!obj || typeof obj !== 'object') return fallback;
  
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) return fallback;
    current = current[key];
  }
  
  return safe(current, fallback);
};

/**
 * Safely call async function with error fallback
 * @param {Function} fn - Async function to call
 * @param {*} fallback - Fallback value on error
 * @param {*} errorHandler - Optional error handler
 * @returns {*} - Result or fallback
 */
const safeCall = async (fn, fallback = null, errorHandler = null) => {
  try {
    const result = await fn();
    return safe(result, fallback);
  } catch (error) {
    if (errorHandler) errorHandler(error);
    return fallback;
  }
};

/**
 * Safely convert to number
 * @param {*} value - Value to convert
 * @param {number} fallback - Fallback number
 * @returns {number} - Safe number
 */
const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return isNaN(num) ? fallback : num;
};

/**
 * Safely convert to string
 * @param {*} value - Value to convert
 * @param {string} fallback - Fallback string
 * @returns {string} - Safe string
 */
const safeString = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  return String(value);
};

/**
 * Safely check array length
 * @param {*} arr - Potential array
 * @returns {number} - Safe length
 */
const safeLength = (arr) => {
  if (!Array.isArray(arr)) return 0;
  return arr.length;
};

/**
 * Safely access array element
 * @param {Array} arr - Array
 * @param {number} index - Index
 * @param {*} fallback - Fallback value
 * @returns {*} - Safe element
 */
const safeAt = (arr, index, fallback = null) => {
  if (!Array.isArray(arr)) return fallback;
  if (index < 0 || index >= arr.length) return fallback;
  return safe(arr[index], fallback);
};

module.exports = {
  safe,
  safeGet,
  safeCall,
  safeNumber,
  safeString,
  safeLength,
  safeAt
};
