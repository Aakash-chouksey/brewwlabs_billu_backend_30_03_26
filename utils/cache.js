const redis = require('../config/redis');

/**
 * Cache Utility
 * Production-ready caching layer for the multi-tenant POS system.
 */
const cache = {
    /**
     * Set a value in cache with optional TTL
     * @param {string} key - Cache key
     * @param {any} value - Value to store (will be JSON stringified)
     * @param {number} ttl - Time to live in seconds (default: 3600 / 1 hour)
     */
    set: async (key, value, ttl = 3600) => {
        try {
            if (!redis || redis.status === 'disabled') return;
            const stringValue = JSON.stringify(value);
            await redis.set(key, stringValue, 'EX', ttl);
        } catch (error) {
            console.error(`❌ Cache Set Error [${key}]:`, error.message);
        }
    },

    /**
     * Get a value from cache
     * @param {string} key - Cache key
     * @returns {any|null} Parsed value or null
     */
    get: async (key) => {
        try {
            if (!redis || redis.status === 'disabled') return null;
            const value = await redis.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error(`❌ Cache Get Error [${key}]:`, error.message);
            return null;
        }
    },

    /**
     * Delete a value from cache (invalidate)
     * @param {string} key - Cache key
     */
    del: async (key) => {
        try {
            if (!redis || redis.status === 'disabled') return;
            await redis.del(key);
        } catch (error) {
            console.error(`❌ Cache Delete Error [${key}]:`, error.message);
        }
    },

    /**
     * Generate a multi-tenant aware cache key
     * @param {object} context - { tenantId, brandId, outletId }
     * @param {string} resource - resource name (e.g., 'products')
     * @param {string} suffix - optional suffix (e.g., query params)
     */
    generateKey: (context, resource, suffix = '') => {
        const { tenantId, brandId, outletId } = context;
        let key = `tenant:${tenantId || 'global'}`;
        if (brandId) key += `:brand:${brandId}`;
        if (outletId) key += `:outlet:${outletId}`;
        key += `:${resource}`;
        if (suffix) key += `:${suffix}`;
        return key;
    }
};

module.exports = cache;
