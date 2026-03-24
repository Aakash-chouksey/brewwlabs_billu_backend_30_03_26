/**
 * IN-MEMORY RATE LIMITER
 * 
 * Production-safe rate limiting without Redis dependency
 * Uses Map for storage with automatic cleanup
 */

class InMemoryRateLimiter {
  constructor() {
    this.requests = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Cleanup every minute
  }

  /**
   * Check and increment rate limit
   * @param {string} key - Unique identifier (IP, user+IP, etc.)
   * @param {number} windowMs - Time window in milliseconds
   * @param {number} maxRequests - Maximum requests allowed in window
   * @returns {Object} Rate limit status
   */
  async checkLimit(key, windowMs = 15 * 60 * 1000, maxRequests = 100) {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get existing requests for this key
    let requests = this.requests.get(key) || [];
    
    // Filter out expired requests
    requests = requests.filter(timestamp => timestamp > windowStart);
    
    // Check if limit exceeded
    const currentCount = requests.length;
    const exceeded = currentCount >= maxRequests;
    
    if (!exceeded) {
      // Add current request
      requests.push(now);
      this.requests.set(key, requests);
    }

    // Calculate reset time
    const oldestRequest = requests[0] || now;
    const resetTime = oldestRequest + windowMs;
    const remaining = Math.max(0, maxRequests - requests.length);

    return {
      allowed: !exceeded,
      totalHits: requests.length,
      remaining,
      resetTime,
      windowMs
    };
  }

  /**
   * Reset rate limit for a key
   * @param {string} key - Key to reset
   */
  async resetLimit(key) {
    this.requests.delete(key);
    return true;
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, requests] of this.requests.entries()) {
      // Keep only requests from last hour (max window we support)
      const validRequests = requests.filter(timestamp => now - timestamp < 3600000);
      if (validRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validRequests);
      }
    }
  }

  /**
   * Get current stats
   */
  getStats() {
    return {
      totalKeys: this.requests.size,
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Stop cleanup interval (for testing)
   */
  stop() {
    clearInterval(this.cleanupInterval);
  }
}

// Singleton instance
const rateLimiter = new InMemoryRateLimiter();

/**
 * Create Express middleware for rate limiting
 */
function createRateLimitMiddleware(options = {}) {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    keyGenerator = (req) => req.ip,
    message = 'Too many requests, please try again later.',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return async (req, res, next) => {
    try {
      const key = keyGenerator(req);
      const result = await rateLimiter.checkLimit(key, windowMs, max);

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': max,
        'X-RateLimit-Remaining': result.remaining,
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
      });

      if (!result.allowed) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          message,
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        });
      }

      // Track response for skip options
      if (skipSuccessfulRequests || skipFailedRequests) {
        res.on('finish', () => {
          const statusCode = res.statusCode;
          const isSuccess = statusCode >= 200 && statusCode < 400;
          
          if ((skipSuccessfulRequests && isSuccess) || (skipFailedRequests && !isSuccess)) {
            // Don't count this request
            const requests = rateLimiter.requests.get(key) || [];
            requests.pop(); // Remove the last request we added
            if (requests.length === 0) {
              rateLimiter.requests.delete(key);
            } else {
              rateLimiter.requests.set(key, requests);
            }
          }
        });
      }

      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      // Fail open - allow request if rate limiter fails
      next();
    }
  };
}

module.exports = {
  InMemoryRateLimiter,
  rateLimiter,
  createRateLimitMiddleware
};
