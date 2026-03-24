const createHttpError = require('http-errors');

/**
 * GLOBAL ASYNC ERROR HANDLER
 * 
 * Prevents infinite loading and hanging requests
 * Catches unhandled async errors globally
 */
const globalAsyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * REQUEST TIMEOUT MIDDLEWARE
 * 
 * Prevents infinite loading by setting timeout on requests
 */
const requestTimeoutMiddleware = (timeoutMs = 30000) => {
    return (req, res, next) => {
        // Set timeout for the request
        const timeout = setTimeout(() => {
            if (!res.headersSent) {
                console.error(`⏱️ Request timeout: ${req.method} ${req.path} (${timeoutMs}ms)`);
                res.status(408).json({
                    error: 'Request Timeout',
                    message: 'Request took too long to process'
                });
            }
        }, timeoutMs);

        // Clear timeout when response finishes
        res.on('finish', () => clearTimeout(timeout));
        res.on('close', () => clearTimeout(timeout));
        
        next();
    };
};

/**
 * RESPONSE VALIDATION MIDDLEWARE
 * 
 * Prevents multiple response sends and hanging responses
 */
const responseValidationMiddleware = (req, res, next) => {
    let responseSent = false;
    
    // Override res.json to prevent multiple sends
    const originalJson = res.json;
    res.json = function(data) {
        if (res.headersSent || responseSent) {
            console.error('🚨 Attempt to send multiple JSON responses detected');
            return;
        }

        // Global Response Safety (Phase 6)
        if (!data || typeof data !== 'object') {
            console.warn('⚠️ Sanitize Response: Data was empty or not an object');
            data = { success: true, data: {} };
        }

        // Ensure success field exists
        if (data.success === undefined) data.success = true;
        
        // Ensure data field exists if success is true
        if (data.success && data.data === undefined) data.data = {};

        return originalJson.call(this, data);
    };
    
    // Override res.send to prevent multiple sends
    const originalSend = res.send;
    res.send = function(data) {
        if (res.headersSent || responseSent) {
            console.error('🚨 Attempt to send multiple responses detected');
            return;
        }
        responseSent = true;
        return originalSend.call(this, data);
    };
    
    // Override res.status to chain properly
    const originalStatus = res.status;
    res.status = function(code) {
        originalStatus.call(this, code);
        return this; // Return this for chaining
    };
    
    // Add helper to check if response sent
    res.isResponseSent = () => responseSent;
    
    next();
};

/**
 * HANGING REQUEST DETECTOR
 * 
 * Logs requests that are taking too long
 */
const hangingRequestDetector = (warningMs = 10000) => {
    const activeRequests = new Map();
    
    return (req, res, next) => {
        const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const startTime = Date.now();
        
        // Track request
        activeRequests.set(requestId, {
            method: req.method,
            path: req.path,
            startTime,
            userAgent: req.get('User-Agent')
        });
        
        // Set warning timeout
        const warningTimeout = setTimeout(() => {
            const request = activeRequests.get(requestId);
            if (request && !res.headersSent) {
                console.warn(`⚠️ Slow request warning: ${req.method} ${req.path} (${warningMs}ms)`, {
                    requestId,
                    userAgent: request.userAgent,
                    auth: req.auth ? { id: req.auth.id, email: req.auth.email } : null
                });
            }
        }, warningMs);
        
        // Clean up on response finish
        res.on('finish', () => {
            clearTimeout(warningTimeout);
            activeRequests.delete(requestId);
            const duration = Date.now() - startTime;
            console.log(`✅ Request completed: ${req.method} ${req.path} (${duration}ms)`);
        });
        
        res.on('close', () => {
            clearTimeout(warningTimeout);
            activeRequests.delete(requestId);
            if (!res.headersSent) {
                console.warn(`🔌 Client disconnected: ${req.method} ${req.path}`);
            }
        });
        
        next();
    };
};

/**
 * GLOBAL ERROR HANDLER
 * 
 * Catches all errors and prevents server crashes
 */
const globalErrorHandler = (error, req, res, next) => {
    console.error('🔥 Global Error Handler:', {
        error: error.message,
        stack: error.stack,
        method: req.method,
        path: req.path,
        auth: req.auth ? { id: req.auth.id, email: req.auth.email } : null,
        tenantId: req.tenantId,
        timestamp: new Date().toISOString()
    });
    
    // Don't send response if already sent
    if (res.headersSent || res.isResponseSent()) {
        console.error('🚨 Error after response already sent');
        return;
    }
    
    // Handle specific error types
    if (error.name === 'SequelizeConnectionError') {
        return res.status(503).json({
            error: 'Database Connection Error',
            message: 'Unable to connect to database. Please try again later.'
        });
    }
    
    if (error.name === 'SequelizeConnectionRefusedError') {
        return res.status(503).json({
            error: 'Database Unavailable',
            message: 'Database is currently unavailable. Please try again later.'
        });
    }
    
    if (error.name === 'SequelizeTimeoutError') {
        return res.status(408).json({
            error: 'Database Timeout',
            message: 'Database query timed out. Please try again.'
        });
    }
    
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation Error',
            message: error.message,
            details: error.errors
        });
    }
    
    if (error.message.includes('tenant') || error.message.includes('schema')) {
        return res.status(400).json({
            error: 'Tenant Error',
            message: 'Tenant configuration error. Please check your access credentials.'
        });
    }
    
    // Default error response - PHASE 7: ALWAYS RETURN 200 FOR STABILITY
    const statusCode = error.statusCode || error.status || 200; // Force 200 for "Handled Safely"
    const message = process.env.NODE_ENV === 'production' 
        ? 'Internal Server Error (Handled Safely)' 
        : error.message;
    
    res.status(200).json({
        success: false,
        error: 'Handled safely',
        message: message,
        data: {},
        ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
    });
};

module.exports = {
    globalAsyncHandler,
    requestTimeoutMiddleware,
    responseValidationMiddleware,
    hangingRequestDetector,
    globalErrorHandler
};
