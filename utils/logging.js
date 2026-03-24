/**
 * REQUEST LOGGING MIDDLEWARE
 * 
 * Provides comprehensive request/response logging for debugging.
 * Logs timing, status, and errors without impacting performance.
 */

const { safeString, safeNumber } = require('./safeDb');

/**
 * Create request logging middleware
 * @param {Object} options - Configuration options
 * @returns {Function} Express middleware
 */
function requestLogger(options = {}) {
  const {
    logRequests = true,
    logResponses = true,
    logErrors = true,
    slowThreshold = 1000, // ms
    skipPaths = ['/health', '/favicon.ico']
  } = options;

  return (req, res, next) => {
    // Skip if path is in skip list
    if (skipPaths.some(path => req.path.includes(path))) {
      return next();
    }

    const start = Date.now();
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Attach request ID
    req.requestId = requestId;

    if (logRequests) {
      console.log(`📥 [${requestId}] ${req.method} ${req.originalUrl} - Started`);
    }

    // Capture response finish
    res.on('finish', () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      
      const emoji = status >= 500 ? '❌' : status >= 400 ? '⚠️' : status >= 300 ? '🔄' : '✅';
      const isSlow = duration > slowThreshold;
      
      if (logResponses) {
        if (isSlow) {
          console.warn(`🐌 [${requestId}] SLOW ${req.method} ${req.originalUrl} → ${status} (${duration}ms)`);
        } else {
          console.log(`${emoji} [${requestId}] ${req.method} ${req.originalUrl} → ${status} (${duration}ms)`);
        }
      }

      // Log errors separately
      if (logErrors && status >= 400) {
        console.error(`❌ [${requestId}] ERROR ${req.method} ${req.originalUrl} → ${status}`);
      }
    });

    // Capture errors
    res.on('error', (error) => {
      console.error(`💥 [${requestId}] RESPONSE ERROR: ${safeString(error?.message)}`);
    });

    next();
  };
}

/**
 * Simple timing middleware
 * Logs request duration for performance monitoring
 */
function timingMiddleware(req, res, next) {
  req.startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    req.duration = duration;
    
    // Store timing data for other middleware
    if (duration > 1000) {
      console.warn(`⏱️ SLOW REQUEST: ${req.method} ${req.originalUrl} (${duration}ms)`);
    }
  });
  
  next();
}

/**
 * Error logging middleware
 * Catches and logs errors before they reach the global handler
 */
function errorLogger(err, req, res, next) {
  const errorInfo = {
    message: safeString(err?.message),
    stack: safeString(err?.stack),
    path: safeString(req?.originalUrl),
    method: safeString(req?.method),
    requestId: req?.requestId || 'unknown',
    timestamp: new Date().toISOString()
  };
  
  console.error('❌ ERROR LOGGER:', errorInfo);
  
  // Pass to next error handler
  next(err);
}

/**
 * Data validation logging
 * Logs data validation issues for debugging
 */
function validationLogger(req, res, next) {
  // Check for common data issues
  if (req.body && typeof req.body === 'object') {
    for (const [key, value] of Object.entries(req.body)) {
      if (value === undefined) {
        console.warn(`⚠️ UNDEFINED VALUE in body: ${key}`);
      }
      if (value === null && key.includes('Id')) {
        console.warn(`⚠️ NULL ID in body: ${key}`);
      }
    }
  }
  
  next();
}

module.exports = {
  requestLogger,
  timingMiddleware,
  errorLogger,
  validationLogger
};
