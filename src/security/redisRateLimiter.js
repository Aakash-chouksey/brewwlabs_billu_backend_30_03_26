const redis = require('../cache/redisClient');

/**
 * Redis-based Rate Limiting System
 * Provides advanced rate limiting with user+IP+tenant keys and sliding windows
 */
class RedisRateLimiter {
    constructor() {
        this.defaultLimits = {
            // Global limits
            global: {
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 500, // 500 requests per window
                keyGenerator: (req) => `rate_limit:global:${req.ip}`
            },
            
            // Authentication endpoints (stricter)
            auth: {
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 20, // 20 auth attempts per window
                keyGenerator: (req) => `rate_limit:auth:${req.ip}`
            },
            
            // Login endpoints (very strict)
            login: {
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 10, // 10 login attempts per window
                keyGenerator: (req) => `rate_limit:login:${req.ip}:${req.body.email || 'unknown'}`
            },
            
            // Order endpoints (moderate)
            orders: {
                windowMs: 5 * 60 * 1000, // 5 minutes
                max: 100, // 100 orders per 5 minutes
                keyGenerator: (req) => `rate_limit:orders:${req.auth?.id || req.ip}:${req.tenant?.brandId || 'unknown'}`
            },
            
            // Admin endpoints (strict)
            admin: {
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 200, // 200 admin requests per window
                keyGenerator: (req) => `rate_limit:admin:${req.auth?.id || req.ip}:${req.tenant?.brandId || 'unknown'}`
            },
            
            // API endpoints (general)
            api: {
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 1000, // 1000 API requests per window
                keyGenerator: (req) => `rate_limit:api:${req.auth?.id || req.ip}:${req.tenant?.brandId || 'unknown'}`
            }
        };
    }

    /**
     * Create rate limiting middleware
     */
    createMiddleware(options = {}) {
        const config = { ...this.defaultLimits.api, ...options };
        
        return async (req, res, next) => {
            try {
                // Check if Redis is available
                const redis = require('../cache/redisClient');
                if (!redis || redis.isMock) {
                    // Redis not available - skip rate limiting but log warning
                    console.warn('⚠️ Redis not available - rate limiting disabled');
                    return next();
                }

                const key = config.keyGenerator(req);
                const result = await this.checkRateLimit(key, config);
                
                // Set rate limit headers
                res.set({
                    'X-RateLimit-Limit': config.max,
                    'X-RateLimit-Remaining': result.remaining,
                    'X-RateLimit-Reset': result.resetTime
                });

                if (result.exceeded) {
                    // Log rate limit violation
                    await this._logRateLimitViolation(req, config, result);
                    
                    return res.status(429).json({
                        error: 'Too Many Requests',
                        message: config.message || 'Rate limit exceeded',
                        retryAfter: Math.ceil(result.ttl / 1000),
                        limit: config.max,
                        remaining: result.remaining,
                        resetTime: result.resetTime
                    });
                }

                next();

            } catch (error) {
                console.error('Rate limiting error:', error);
                // Fail open - don't block requests if Redis is down
                next();
            }
        };
    }

    /**
     * Check rate limit using Redis sliding window
     */
    async checkRateLimit(key, config) {
        try {
            const redis = require('../cache/redisClient');
            if (!redis || redis.isMock) {
                // Redis not available - return default values
                return {
                    requestCount: 0,
                    remaining: config.max,
                    exceeded: false,
                    ttl: 0,
                    resetTime: Date.now() + config.windowMs
                };
            }

            const now = Date.now();
            const window = config.windowMs;
            const max = config.max;
            
            // Check if Redis supports pipeline (mock client doesn't)
            if (typeof redis.pipeline !== 'function') {
                // Mock Redis or unsupported client - return default values
                return {
                    requestCount: 0,
                    remaining: config.max,
                    exceeded: false,
                    ttl: 0,
                    resetTime: Date.now() + config.windowMs
                };
            }
            
            // Use Redis sorted set for sliding window
            const pipeline = redis.pipeline();
            
            // Remove expired entries
            pipeline.zremrangebyscore(key, 0, now - window);
            
            // Add current request
            pipeline.zadd(key, now, `${now}-${Math.random()}`);
            
            // Count requests in window
            pipeline.zcard(key);
            
            // Set expiry
            pipeline.expire(key, Math.ceil(window / 1000));
            
            const results = await pipeline.exec();
            const requestCount = results[2][1]; // zcard result
            
            const remaining = Math.max(0, max - requestCount);
            const exceeded = requestCount > max;
            const ttl = await redis.pttl(key);
            const resetTime = now + ttl;

            return {
                requestCount,
                remaining,
                exceeded,
                ttl,
                resetTime
            };

        } catch (error) {
            console.error('Rate limit check failed:', error);
            // Fail open
            return {
                requestCount: 0,
                remaining: config.max,
                exceeded: false,
                ttl: 0,
                resetTime: Date.now() + config.windowMs
            };
        }
    }

    /**
     * Log rate limit violations
     */
    async _logRateLimitViolation(req, config, result) {
        try {
            const AuditLogger = require('./auditLogger');
            await AuditLogger.logRateLimitViolation(req.ip, req.get('User-Agent'), {
                limit: config.max,
                requestCount: result.requestCount,
                windowMs: config.windowMs,
                key: config.keyGenerator(req),
                method: req.method
            });
        } catch (error) {
            console.error('Failed to log rate limit violation:', error);
        }
    }

    /**
     * Check if user is blocked (for repeated violations)
     */
    async isUserBlocked(userId, ip) {
        try {
            const blockKey = `blocked:${userId || ip}`;
            const blocked = await redis.get(blockKey);
            return blocked !== null;
        } catch (error) {
            console.error('Block check failed:', error);
            return false;
        }
    }

    /**
     * Block user temporarily
     */
    async blockUser(userId, ip, durationMinutes = 30) {
        try {
            const blockKey = `blocked:${userId || ip}`;
            await redis.set(blockKey, JSON.stringify({
                blockedAt: new Date().toISOString(),
                reason: 'Rate limit violations',
                duration: durationMinutes
            }), "EX", durationMinutes * 60);

            console.log(`🚫 Blocked user ${userId || ip} for ${durationMinutes} minutes`);
            return true;
        } catch (error) {
            console.error('Failed to block user:', error);
            return false;
        }
    }

    /**
     * Get rate limit statistics
     */
    async getStats(pattern = 'rate_limit:*') {
        try {
            const keys = await redis.keys(pattern);
            const stats = {
                totalKeys: keys.length,
                activeLimits: {},
                topConsumers: []
            };

            for (const key of keys.slice(0, 100)) { // Limit to first 100 keys
                const ttl = await redis.pttl(key);
                const count = await redis.zcard(key);
                
                if (ttl > 0) {
                    stats.activeLimits[key] = {
                        requests: count,
                        ttl: ttl,
                        resetTime: Date.now() + ttl
                    };
                }
            }

            return stats;
        } catch (error) {
            console.error('Failed to get rate limit stats:', error);
            return { error: error.message };
        }
    }

    /**
     * Reset rate limit for specific key
     */
    async resetLimit(key) {
        try {
            await redis.del(key);
            return true;
        } catch (error) {
            console.error('Failed to reset rate limit:', error);
            return false;
        }
    }
}

// Export singleton instance
module.exports = new RedisRateLimiter();
