/**
 * IN-MEMORY TOKEN BLACKLIST
 * 
 * Provides token revocation without Redis dependency
 * Uses Map with automatic cleanup of expired tokens
 */

class InMemoryTokenBlacklist {
  constructor() {
    this.blacklist = new Map();
    this.tokenVersions = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000); // Cleanup every 5 minutes
  }

  /**
   * Add token to blacklist
   * @param {string} token - JWT token or JTI
   * @param {string} jti - JWT ID (preferred)
   * @param {string} userId - User ID
   * @param {number} expiresIn - Seconds until expiry
   * @returns {boolean}
   */
  async blacklistToken(token, jti, userId, expiresIn = 24 * 60 * 60) {
    try {
      const key = jti || token;
      const expiresAt = Date.now() + (expiresIn * 1000);
      
      this.blacklist.set(key, {
        userId,
        blacklistedAt: new Date().toISOString(),
        expiresAt
      });
      
      return true;
    } catch (error) {
      console.error('Failed to blacklist token:', error);
      return false;
    }
  }

  /**
   * Check if token is blacklisted
   * @param {string} token - JWT token
   * @param {string} jti - JWT ID
   * @returns {boolean}
   */
  async isTokenBlacklisted(token, jti) {
    try {
      const key = jti || token;
      const entry = this.blacklist.get(key);
      
      if (!entry) return false;
      
      // Check if expired
      if (Date.now() > entry.expiresAt) {
        this.blacklist.delete(key);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Failed to check token blacklist:', error);
      // Fail safe - allow token if check fails
      return false;
    }
  }

  /**
   * Invalidate all user tokens by incrementing version
   * @param {string} userId - User ID
   * @param {string} role - User role
   * @returns {number|null} New version number
   */
  async invalidateUserTokens(userId, role = 'TENANT') {
    try {
      const currentVersion = this.tokenVersions.get(userId) || 0;
      const newVersion = currentVersion + 1;
      
      // Store with 7 day expiry
      const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
      this.tokenVersions.set(userId, {
        version: newVersion,
        expiresAt
      });
      
      return newVersion;
    } catch (error) {
      console.error('Failed to invalidate user tokens:', error);
      return null;
    }
  }

  /**
   * Get current token version for user
   * @param {string} userId - User ID
   * @returns {number}
   */
  async getTokenVersion(userId) {
    try {
      const entry = this.tokenVersions.get(userId);
      
      if (!entry) return 0;
      
      // Check if expired
      if (Date.now() > entry.expiresAt) {
        this.tokenVersions.delete(userId);
        return 0;
      }
      
      return entry.version;
    } catch (error) {
      console.error('Failed to get token version:', error);
      return 0;
    }
  }

  /**
   * Validate token version
   * @param {string} userId - User ID
   * @param {number} tokenVersion - Version from JWT
   * @returns {boolean}
   */
  async validateTokenVersion(userId, tokenVersion) {
    const currentVersion = await this.getTokenVersion(userId);
    return tokenVersion >= currentVersion;
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    
    // Cleanup blacklist
    for (const [key, entry] of this.blacklist.entries()) {
      if (now > entry.expiresAt) {
        this.blacklist.delete(key);
      }
    }
    
    // Cleanup token versions
    for (const [userId, entry] of this.tokenVersions.entries()) {
      if (now > entry.expiresAt) {
        this.tokenVersions.delete(userId);
      }
    }
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      blacklistedTokens: this.blacklist.size,
      trackedUsers: this.tokenVersions.size
    };
  }

  /**
   * Stop cleanup interval
   */
  stop() {
    clearInterval(this.cleanupInterval);
  }
}

// Export singleton
module.exports = new InMemoryTokenBlacklist();
