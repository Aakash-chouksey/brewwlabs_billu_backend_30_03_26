/**
 * Common math utilities for handling decimal precision.
 */

/**
 * Rounds a number to a specified number of decimal places.
 * Default is 2 decimal places for financial calculations.
 * @param {number|string} value 
 * @param {number} decimals 
 * @returns {number}
 */
const roundTo = (value, decimals = 2) => {
    const num = Number(value);
    if (isNaN(num)) return 0;
    return Number(Math.round(num + "e" + decimals) + "e-" + decimals);
};

module.exports = {
    roundTo
};
