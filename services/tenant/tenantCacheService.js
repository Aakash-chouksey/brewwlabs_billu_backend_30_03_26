/**
 * TENANT CACHE SERVICE
 * 
 * Lightweight in-memory cache for per-tenant metadata (Categories, Product Types, etc.)
 * Optimized for reduce DB load on frequent reads.
 */

class TenantCacheService {
    constructor() {
        // Map<tenantId, Map<key, { data, expiry }>>
        this.cache = new Map();
        this.DEFAULT_TTL = 300000; // 5 minutes
    }

    /**
     * Get from cache
     */
    get(tenantId, key) {
        if (!this.cache.has(tenantId)) return null;
        
        const tenantCache = this.cache.get(tenantId);
        const entry = tenantCache.get(key);
        
        if (!entry) return null;
        
        // Check expiry
        if (Date.now() > entry.expiry) {
            tenantCache.delete(key);
            return null;
        }
        
        return entry.data;
    }

    /**
     * Set to cache
     */
    set(tenantId, key, data, ttl = this.DEFAULT_TTL) {
        if (!this.cache.has(tenantId)) {
            this.cache.set(tenantId, new Map());
        }
        
        const tenantCache = this.cache.get(tenantId);
        tenantCache.set(key, {
            data,
            expiry: Date.now() + ttl
        });
    }

    /**
     * Invalidate tenant cache
     */
    invalidate(tenantId, key = null) {
        if (!this.cache.has(tenantId)) return;
        
        if (key) {
            this.cache.get(tenantId).delete(key);
        } else {
            this.cache.delete(tenantId);
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        let totalKeys = 0;
        const tenantCount = this.cache.size;
        
        for (const tenantCache of this.cache.values()) {
            totalKeys += tenantCache.size;
        }
        
        return {
            tenants: tenantCount,
            totalKeys,
            memoryUsage: process.memoryUsage().heapUsed
        };
    }
}

// Singleton instance
const tenantCacheService = new TenantCacheService();
module.exports = tenantCacheService;
