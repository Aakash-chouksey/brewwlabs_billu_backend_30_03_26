const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

/**
 * Simple in-memory rate limiter factory
 * Removes Redis dependency for stability
 */

// Centralize rate limiter generation to ensure uniform secure configuration
const createRateLimiter = ({ 
    windowMs = 15 * 60 * 1000, 
    max = 100, 
    messageStr, 
    retryAfter, 
    prefix = 'rl:',
    skipSuccessfulRequests = true,
    skipFailedRequests = true,
    useEmailInKey = false,
    customHandler = null 
}) => {
    const config = {
        windowMs,
        max,
        message: {
            success: false,
            message: messageStr,
            retryAfter: retryAfter || `${windowMs / 1000 / 60} minutes`
        },
        standardHeaders: true,
        legacyHeaders: false,
        // Use memory store - no Redis dependency for stability
        // skipSuccessfulRequests: don't count successful requests toward limit
        skipSuccessfulRequests,
        // skipFailedRequests: don't count failed requests toward limit (prevents totalHits=0 issues)
        skipFailedRequests,
        // Secure IP-level key generator using ipKeyGenerator helper for IPv6 compatibility
        keyGenerator: (req, res) => {
            const safeIpKey = ipKeyGenerator(req, res);
            if (useEmailInKey && req.body?.email) {
                return `${safeIpKey}:${req.body.email}`;
            }
            return `${prefix}${safeIpKey}`;
        }
    };

    if (customHandler) {
        config.handler = (req, res, next, options) => {
            const safeIpKey = ipKeyGenerator(req, res);
            console.warn(`🚨 Rate limit exceeded [${prefix}]: IP=${safeIpKey}, Email=${req.body?.email || 'N/A'}`);
            res.status(429).json({
                success: false,
                message: customHandler.message || messageStr,
                retryAfter: retryAfter || `${windowMs / 1000 / 60} minutes`
            });
        };
    }

    return rateLimit(config);
};

module.exports = {
    createRateLimiter
};
