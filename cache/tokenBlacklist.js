/**
 * Token Blacklist Module
 * In-memory token blacklist (NO REDIS)
 * Used for invalidated tokens (logout, password change, etc.)
 */

// In-memory storage for blacklisted tokens
const tokenBlacklist = new Set();

// Periodic cleanup of expired entries (optional optimization)
const cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours

module.exports = {
  /**
   * Add a token to the blacklist
   * @param {string} token - JWT token to blacklist
   */
  add: (token) => {
    if (token) {
      tokenBlacklist.add(token);
      console.log(`🔒 Token blacklisted. Total blacklisted: ${tokenBlacklist.size}`);
    }
  },

  /**
   * Check if a token is blacklisted
   * @param {string} token - JWT token to check
   * @returns {boolean} - True if token is blacklisted
   */
  has: (token) => {
    return token ? tokenBlacklist.has(token) : false;
  },

  /**
   * Remove a token from the blacklist (optional)
   * @param {string} token - JWT token to remove
   */
  remove: (token) => {
    if (token) {
      tokenBlacklist.delete(token);
    }
  },

  /**
   * Get the size of the blacklist (for monitoring)
   * @returns {number}
   */
  size: () => tokenBlacklist.size,

  /**
   * Clear all blacklisted tokens (use with caution)
   */
  clear: () => {
    tokenBlacklist.clear();
    console.log('🧹 Token blacklist cleared');
  }
};
