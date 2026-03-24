/**
 * Redis Configuration Module - NO REDIS VERSION
 * Provides in-memory mock implementation for compatibility
 * All caching disabled - direct database queries only
 */

console.log('ℹ️  Redis: DISABLED - Using in-memory mock (Data-First Architecture)');

// In-memory storage for minimal compatibility
const memoryStore = new Map();

/**
 * Mock Redis client - fully functional without external dependencies
 */
const mockRedis = {
  // Connection events (no-op)
  on: () => mockRedis,
  
  // Basic operations
  get: async (key) => {
    const item = memoryStore.get(key);
    if (!item) return null;
    if (item.expiry && item.expiry < Date.now()) {
      memoryStore.delete(key);
      return null;
    }
    return item.value;
  },
  
  set: async (key, value, ...args) => {
    let expiry = null;
    // Parse EX/PX arguments
    for (let i = 0; i < args.length; i++) {
      if (args[i] === 'EX') {
        expiry = Date.now() + (args[i + 1] * 1000);
        i++;
      } else if (args[i] === 'PX') {
        expiry = Date.now() + args[i + 1];
        i++;
      }
    }
    memoryStore.set(key, { value, expiry });
    return 'OK';
  },
  
  del: async (...keys) => {
    let deleted = 0;
    keys.forEach(key => {
      if (memoryStore.has(key)) {
        memoryStore.delete(key);
        deleted++;
      }
    });
    return deleted;
  },
  
  // Connection management
  ping: async () => 'PONG',
  quit: async () => 'OK',
  
  // Rate limiting compatibility (for rate-limit-redis)
  call: async (command, ...args) => {
    if (command === 'SCRIPT' && args[0] === 'LOAD') {
      return 'mocksha1234567890abcdef';
    }
    if (command === 'EVALSHA') {
      const resetTime = Date.now() + 900000;
      return [1, resetTime];
    }
    return null;
  },
  
  // Status
  status: 'disabled',
  
  // Utility methods
  clear: () => memoryStore.clear(),
  size: () => memoryStore.size,
  stats: () => ({ keys: memoryStore.size })
};

/**
 * Initialize Redis client - always returns mock
 */
async function initializeRedis() {
  console.log('✅ Redis: Using in-memory mock (no external dependency)');
  return mockRedis;
}

/**
 * Get Redis client instance
 */
function getRedisClient() {
  return mockRedis;
}

/**
 * Check if Redis is connected (always false for mock)
 */
function isRedisConnected() {
  return false;
}

/**
 * Gracefully close Redis connection
 */
async function closeRedis() {
  memoryStore.clear();
  console.log('✅ Redis: In-memory cache cleared');
}

/**
 * Redis health check
 */
async function healthCheck() {
  return { 
    status: 'disabled', 
    message: 'Redis disabled - using in-memory mock',
    timestamp: new Date().toISOString()
  };
}

// Attach helpers to the mock instance
mockRedis.initializeRedis = initializeRedis;
mockRedis.getRedisClient = getRedisClient;
mockRedis.isRedisConnected = isRedisConnected;
mockRedis.closeRedis = closeRedis;
mockRedis.healthCheck = healthCheck;
mockRedis.isMock = true;

module.exports = mockRedis;

