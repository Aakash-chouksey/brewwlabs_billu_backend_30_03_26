const redis = require('../../config/redis');

/**
 * Initialize Redis client for tenant caching
 */
async function initializeRedis() {
    try {
        if (!redis || redis.status === 'disabled') {
            console.warn('⚠️  Redis: Disabled (missing URL)');
            return null;
        }

        // Test connection
        await redis.ping();
        console.log('✅ Redis: Connection verified');
        
        return redis;
    } catch (error) {
        console.error('❌ Redis: Initialization error:', error.message);
        // We don't re-throw here to allow app to start without redis
        return null; 
    }
}

/**
 * Get Redis client instance
 */
function getRedisClient() {
    return redis;
}

/**
 * Check if Redis is connected
 */
function isRedisConnected() {
    return redis && (redis.status === 'ready' || redis.status === 'connect');
}

/**
 * Gracefully close Redis connection
 */
async function closeRedis() {
    if (redis && typeof redis.quit === 'function') {
        await redis.quit();
        console.log('✅ Redis: Connection closed');
    }
}

/**
 * Redis health check
 */
async function healthCheck() {
    try {
        if (!redis || redis.status === 'disabled') {
            return { status: 'disabled', message: 'Redis is not configured' };
        }
        
        const start = Date.now();
        await redis.ping();
        const latency = Date.now() - start;
        
        return { 
            status: 'connected', 
            latency: `${latency}ms`,
            message: 'Redis is healthy'
        };
    } catch (error) {
        return { 
            status: 'error', 
            message: error.message 
        };
    }
}

// Attach helpers to the redis instance for backward compatibility
redis.initializeRedis = initializeRedis;
redis.getRedisClient = getRedisClient;
redis.isRedisConnected = isRedisConnected;
redis.closeRedis = closeRedis;
redis.healthCheck = healthCheck;
redis.isMock = (redis.status === 'disabled');

module.exports = redis;

