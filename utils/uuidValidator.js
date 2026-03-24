/**
 * UUID VALIDATOR UTILITY
 * 
 * Provides safe UUID validation and conversion utilities
 */

const { v4: isUuid, validate: isValidUUIDString } = require('uuid');

/**
 * Validates if a string is a valid UUID
 * @param {string} uuidString - The string to validate
 * @returns {boolean} True if valid UUID, false otherwise
 */
function isValidUUID(uuidString) {
    if (!uuidString || typeof uuidString !== 'string') {
        return false;
    }
    
    try {
        // Use UUID library for strict validation
        return isValidUUIDString(uuidString);
    } catch (error) {
        console.warn(`⚠️  UUID validation warning for ${uuidString}: ${error.message}`);
        return false;
    }
}

/**
 * Safely converts UUID string to proper format for database queries
 * @param {string|null} uuidString - The UUID to convert
 * @returns {string|null} Properly formatted UUID or null if invalid
 */
function formatUUIDForDB(uuidString) {
    if (!uuidString) {
        return null;
    }
    
    try {
        // Validate and normalize the UUID
        const normalized = isValidUUIDString(uuidString);
        if (!normalized) {
            return null;
        }
        
        return normalized;
    } catch (error) {
        console.warn(`⚠️  UUID formatting error for ${uuidString}: ${error.message}`);
        return null;
    }
}

/**
 * Extracts UUID from request headers safely
 * @param {object} headers - Request headers
 * @param {string} headerName - Name of the header containing UUID
 * @returns {string|null} UUID string or null
 */
function extractUUIDFromHeaders(headers, headerName) {
    if (!headers || !headerName) {
        return null;
    }
    
    const uuidString = headers[headerName];
    return formatUUIDForDB(uuidString);
}

/**
 * Creates a safe WHERE clause for UUID comparisons
 * @param {string} columnName - Name of the UUID column
 * @param {string|null} uuidValue - UUID value to compare
 * @param {boolean} allowNull - Whether NULL values are allowed
 * @returns {string} Safe WHERE clause
 */
function createUUIDWhereClause(columnName, uuidValue, allowNull = false) {
    if (!uuidValue) {
        if (allowNull) {
            return `${columnName} IS NULL`;
        } else {
            return `${columnName} = 'INVALID_UUID'`; // Will never match valid UUIDs
        }
    }
    
    const formattedUUID = formatUUIDForDB(uuidValue);
    if (!formattedUUID) {
        throw new Error(`Invalid UUID format for ${columnName}: ${uuidValue}`);
    }
    
    return `${columnName} = '${formattedUUID}'`;
}

/**
 * Creates a safe JOIN condition for UUID comparisons
 * @param {string} jsonColumn - JSON column containing UUID (e.g., item_data->>'categoryId')
 * @param {string} uuidColumn - UUID column to compare with
 * @param {string|null} uuidValue - UUID value to compare
 * @returns {string} Safe JOIN condition
 */
function createUUIDJoinCondition(jsonColumn, uuidColumn, uuidValue) {
    if (!uuidValue) {
        return `${jsonColumn} IS NULL OR ${uuidColumn} IS NULL`;
    }
    
    const formattedUUID = formatUUIDForDB(uuidValue);
    if (!formattedUUID) {
        throw new Error(`Invalid UUID format for ${jsonColumn}: ${uuidValue}`);
    }
    
    return `${jsonColumn} = '${formattedUUID}'`;
}

module.exports = {
    isValidUUID,
    formatUUIDForDB,
    extractUUIDFromHeaders,
    createUUIDWhereClause,
    createUUIDJoinCondition
};
