const config = require("../config/config");

const globalErrorHandler = (err, req, res, next) => {
    // Log error for debugging (without sensitive data)
    console.error("🔥 Global Error Handler - Error:", {
        message: err.message,
        name: err.name,
        status: err.status || err.statusCode,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });

    // Never expose stack traces in production
    const isDevelopment = process.env.NODE_ENV === "development";
    
    let statusCode = err.status || err.statusCode || 500;
    let message = isDevelopment ? (err.message || "Internal Server Error") : "An unexpected error occurred";

    // Handle specific error types without exposing sensitive details
    if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
        statusCode = 400;
        message = isDevelopment ? err.errors.map(e => e.message).join(', ') : "Validation failed";
    } else if (err.name === 'SequelizeDatabaseError') {
        statusCode = 500;
        // Handle specific PostgreSQL transaction errors
        if (err.original?.code === '25P02' || err.message?.includes('Transaction was aborted due to a previous error')) {
            message = "Transaction failed due to a previous error. Please try again.";
            console.error("🔥 Transaction aborted error detected:", {
                code: err.original?.code || '25P02',
                sql: err.sql,
                path: req.path,
                method: req.method
            });
        } else if (err.original?.code === '40001') {
            message = "Database conflict detected. Please try again.";
        } else if (err.original?.code === '40P01') {
            message = "Database deadlock detected. Please try again.";
        } else {
            message = isDevelopment ? (err.original?.message || err.message) : "Database operation failed";
        }
    } else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = "Invalid authentication token";
    } else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = "Authentication token expired";
    } else if (err.message && err.message.includes('brandId cannot equal businessId')) {
        statusCode = 400;
        message = "Invalid JWT token: brandId cannot equal businessId";
    } else if (err.message && err.message.includes('Failed to decrypt database password')) {
        statusCode = 503;
        message = "Tenant database authentication failed";
        console.error('🔐 CRITICAL: Password decryption failure:', {
            error: err.message,
            path: req.path,
            method: req.method,
            timestamp: new Date().toISOString()
        });
    } else if (err.message && err.message.includes('No tenant connection found')) {
        statusCode = 503;
        message = "Tenant not provisioned or misconfigured";
        console.error('🏢 CRITICAL: Tenant connection failure:', {
            error: err.message,
            path: req.path,
            method: req.method,
            timestamp: new Date().toISOString()
        });
    } else if (err.message && err.message.includes('Model injection failed')) {
        statusCode = 503;
        message = "Tenant database unavailable";
        console.error('🗄️ CRITICAL: Model injection failure:', {
            error: err.message,
            path: req.path,
            method: req.method,
            timestamp: new Date().toISOString()
        });
    } else if (isDevelopment) {
        // In development, show actual error message
        message = err.message || "Internal Server Error";
    }

    // Sanitize error response - never expose internal details in production
    const errorResponse = {
        success: false,
        message: message,
        data: {} // Phase 3: Always return empty data object for stability
    };

    // Only include error details in development
    if (isDevelopment) {
        errorResponse.errorType = err.name;
        errorResponse.errorStack = err.stack;
        errorResponse.originalError = err.message;
        errorResponse.path = req.path;
        errorResponse.method = req.method;
    }

    // Phase 4: Handle "safe" errors with 200 status if they are expected empty results
    const finalStatus = (statusCode === 404 && req.method === 'GET') ? 200 : statusCode;
    
    return res.status(finalStatus).json(errorResponse);
};

module.exports = { globalErrorHandler };