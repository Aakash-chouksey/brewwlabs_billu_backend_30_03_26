/**
 * SAFE DATA ACCESS LAYER
 * 
 * Provides fail-safe data sanitization functions.
 * Backend should NEVER trust database — always sanitize, always fallback.
 */

/**
 * Safely convert value to number
 * @param {any} val - Value to convert
 * @param {number} defaultValue - Default if conversion fails (default: 0)
 * @returns {number} Safe number
 */
const safeNumber = (val) => {
  if (val === null || val === undefined || val === '' || Number.isNaN(val)) {
    throw new Error(`Invalid number provided: ${val}`);
  }
  const num = Number(val);
  if (Number.isNaN(num)) throw new Error(`Could not convert value to number: ${val}`);
  return num;
};

/**
 * Safely ensure value is an array
 * @param {any} val - Value to check
 * @param {Array} defaultValue - Default if not array (default: [])
 * @returns {Array} Safe array
 */
const safeArray = (val) => {
  if (val === null || val === undefined) {
    throw new Error('Array expected but got null/undefined');
  }
  if (Array.isArray(val)) {
    return val;
  }
  // If it's an object with length property (array-like), convert to array
  if (typeof val === 'object' && 'length' in val) {
    try {
      return Array.from(val);
    } catch {
      throw new Error(`Failed to convert value to array: ${val}`);
    }
  }
  throw new Error(`Value is not an array: ${typeof val}`);
};

/**
 * Safely ensure value is an object
 * @param {any} val - Value to check
 * @param {Object} defaultValue - Default if not object (default: {})
 * @returns {Object} Safe object
 */
const safeObject = (val) => {
  if (val === null || val === undefined) {
    throw new Error('Object expected but got null/undefined');
  }
  if (typeof val === 'object' && !Array.isArray(val)) {
    return val;
  }
  throw new Error(`Value is not an object: ${typeof val}`);
};

/**
 * Safely ensure value is a string
 * @param {any} val - Value to check
 * @param {string} defaultValue - Default if not string (default: '')
 * @returns {string} Safe string
 */
const safeString = (val, defaultValue = '') => {
  if (val === null || val === undefined) {
    return defaultValue;
  }
  if (typeof val === 'string') {
    return val;
  }
  try {
    return String(val);
  } catch {
    return defaultValue;
  }
};

/**
 * Safely ensure value is a boolean
 * @param {any} val - Value to check
 * @param {boolean} defaultValue - Default if not boolean (default: false)
 * @returns {boolean} Safe boolean
 */
const safeBoolean = (val, defaultValue = false) => {
  if (val === null || val === undefined) {
    return defaultValue;
  }
  if (typeof val === 'boolean') {
    return val;
  }
  if (typeof val === 'string') {
    return val.toLowerCase() === 'true' || val === '1';
  }
  return Boolean(val);
};

/**
 * Safely access nested object property
 * @param {Object} obj - Object to access
 * @param {string} path - Dot-notation path (e.g., 'user.profile.name')
 * @param {any} defaultValue - Default if path doesn't exist
 * @returns {any} Property value or default
 */
const safeGet = (obj, path, defaultValue = null) => {
  if (!obj || typeof obj !== 'object') {
    return defaultValue;
  }
  
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return defaultValue;
    }
    current = current[key];
  }
  
  return current !== undefined ? current : defaultValue;
};

/**
 * Safely parse JSON string
 * @param {string} str - JSON string to parse
 * @param {any} defaultValue - Default if parsing fails (default: null)
 * @returns {any} Parsed object or default
 */
const safeJsonParse = (str, defaultValue = null) => {
  if (!str || typeof str !== 'string') {
    return defaultValue;
  }
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
};

/**
 * Safely format date
 * @param {any} date - Date value
 * @param {string} defaultValue - Default if invalid (default: '')
 * @returns {string} Formatted date or default
 */
const safeDate = (date, defaultValue = '') => {
  if (!date) {
    return defaultValue;
  }
  try {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) {
      return defaultValue;
    }
    return d.toISOString();
  } catch {
    return defaultValue;
  }
};

/**
 * Safely check if value exists and is not empty
 * @param {any} val - Value to check
 * @returns {boolean} True if value exists and is not empty
 */
const safeHasValue = (val) => {
  if (val === null || val === undefined) {
    return false;
  }
  if (typeof val === 'string') {
    return val.trim().length > 0;
  }
  if (Array.isArray(val)) {
    return val.length > 0;
  }
  if (typeof val === 'object') {
    return Object.keys(val).length > 0;
  }
  return true;
};

/**
 * Safely map over array with error handling
 * @param {any} arr - Array to map
 * @param {Function} fn - Map function
 * @param {Array} defaultValue - Default if mapping fails
 * @returns {Array} Mapped array or default
 */
const safeMap = (arr, fn, defaultValue = []) => {
  const safeArr = safeArray(arr, []);
  try {
    return safeArr.map(fn);
  } catch (err) {
    console.error('❌ SAFE MAP ERROR:', err.message);
    return defaultValue;
  }
};

/**
 * Safely filter array with error handling
 * @param {any} arr - Array to filter
 * @param {Function} fn - Filter function
 * @param {Array} defaultValue - Default if filtering fails
 * @returns {Array} Filtered array or default
 */
const safeFilter = (arr, fn, defaultValue = []) => {
  const safeArr = safeArray(arr, []);
  try {
    return safeArr.filter(fn);
  } catch (err) {
    console.error('❌ SAFE FILTER ERROR:', err.message);
    return defaultValue;
  }
};

/**
 * Safely reduce array with error handling
 * @param {any} arr - Array to reduce
 * @param {Function} fn - Reduce function
 * @param {any} initialValue - Initial value
 * @returns {any} Reduced value or initial
 */
const safeReduce = (arr, fn, initialValue) => {
  const safeArr = safeArray(arr, []);
  try {
    return safeArr.reduce(fn, initialValue);
  } catch (err) {
    console.error('❌ SAFE REDUCE ERROR:', err.message);
    return initialValue;
  }
};

module.exports = {
  safeNumber,
  safeArray,
  safeObject,
  safeString,
  safeBoolean,
  safeGet,
  safeJsonParse,
  safeDate,
  safeHasValue,
  safeMap,
  safeFilter,
  safeReduce
};
