/**
 * GLOBAL DATA VALIDATION UTILITY
 * 
 * Enforces strict 'fail-fast' rules for API responses.
 */

/**
 * Assert that data is a non-empty object
 * @param {any} data - Data to validate
 * @param {string} message - Error message if invalid
 * @throws {Error} If data is invalid or empty
 * @returns {Object} Validated data
 */
function assertValidData(data, message = "Invalid data: Object or non-empty result expected") {
    if (!data || typeof data !== 'object') {
        throw new Error(`${message} (Received: ${typeof data})`);
    }

    if (Object.keys(data).length === 0) {
        throw new Error(`${message} (Received: {})`);
    }

    return data;
}

module.exports = {
    assertValidData
};
