const redis = require('./redisClient');

/**
 * Token Blacklist Service
 * Provides Redis-based token revocation and replay protection
 */
class TokenBlacklist {
    constructor() {
        this.BLACKLIST_PREFIX = 'blacklist:';
        this.TOKEN_VERSION_PREFIX = 'token_version:';
        this.DEFAULT_TTL = 24 * 60 * 60; // 24 hours
    }

    /**
     * Add token to blacklist (for logout)
     */
    async blacklistToken(token, jti, userId, expiresIn = this.DEFAULT_TTL) {
        try {
            const key = `${this.BLACKLIST_PREFIX}${jti || token}`;
            await redis.set(key, JSON.stringify({
                userId,
                blacklistedAt: new Date().toISOString(),
                reason: 'logout'
            }), "EX", expiresIn);
            return true;
        } catch (error) {
            console.error('Failed to blacklist token:', error);
            return false;
        }
    }

    /**
     * Check if token is blacklisted
     */
    async isTokenBlacklisted(token, jti) {
        try {
            const key = `${this.BLACKLIST_PREFIX}${jti || token}`;
            const result = await redis.get(key);
            return result !== null;
        } catch (error) {
            console.error('Failed to check token blacklist:', error);
            // Fail safe - if Redis is down, allow the token
            return false;
        }
    }

    /**
     * Invalidate all user tokens by incrementing token version
     */
    async invalidateUserTokens(userId, role = 'TENANT') {
        try {
            const versionKey = `${this.TOKEN_VERSION_PREFIX}${userId}`;
            const newVersion = await redis.incr(versionKey);
            
            // Set expiry for version key (7 days)
            await redis.expire(versionKey, 7 * 24 * 60 * 60);
            
            return newVersion;
        } catch (error) {
            console.error('Failed to invalidate user tokens:', error);
            return null;
        }
    }

    /**
     * Get current token version for user
     */
    async getTokenVersion(userId) {
        try {
            const versionKey = `${this.TOKEN_VERSION_PREFIX}${userId}`;
            const version = await redis.get(versionKey);
            return version ? parseInt(version) : 0;
        } catch (error) {
            console.error('Failed to get token version:', error);
            return 0;
        }
    }

    /**
     * Cleanup expired tokens (maintenance task)
     */
    async cleanupExpiredTokens() {
        try {
            const pattern = `${this.BLACKLIST_PREFIX}*`;
            const keys = await redis.keys(pattern);
            let cleaned = 0;

            for (const key of keys) {
                const ttl = await redis.ttl(key);
                if (ttl === -1) { // No expiry set, clean it up
                    await redis.del(key);
                    cleaned++;
                }
            }

            return cleaned;
        } catch (error) {
            console.error('Failed to cleanup expired tokens:', error);
            return 0;
        }
    }
}

module.exports = new TokenBlacklist();
