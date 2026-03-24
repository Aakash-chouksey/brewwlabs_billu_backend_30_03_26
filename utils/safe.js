/**
 * NULL SAFETY UTILITIES (Phase 5)
 * Prevents application crashes from undefined/null data.
 */

const safeGet = (obj, path, defaultValue = null) => {
    try {
        const value = path.split('.').reduce((acc, part) => acc && acc[part], obj);
        return value !== undefined && value !== null ? value : defaultValue;
    } catch (e) {
        return defaultValue;
    }
};

const safeNumber = (value, defaultValue = 0) => {
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
};

const safeString = (value, defaultValue = '') => {
    return value !== undefined && value !== null ? String(value) : defaultValue;
};

const safeArray = (value) => {
    return Array.isArray(value) ? value : [];
};

module.exports = {
    safeGet,
    safeNumber,
    safeString,
    safeArray
};
