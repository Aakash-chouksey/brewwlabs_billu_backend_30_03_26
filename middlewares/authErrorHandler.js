const createHttpError = require('http-errors');
const { logAuthEvent } = require('../security/auditLogger');

/**
 * Enhanced Authentication Error Handler
 * Provides secure, consistent error responses for authentication endpoints
 */

class AuthErrorHandler {
    /**
     * Handle authentication errors with proper security measures
     */
    static async handleAuthError(error, req, res, next) {
        const clientIP = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');
        const path = req.path;
        const method = req.method;
        
        // Determine error type and appropriate response
        let statusCode = 500;
        let message = 'Internal server error';
        let shouldLog = true;
        let includeDetails = false;
        
        // Classify error types
        if (error.name === 'UnauthorizedError' || error.status === 401) {
            statusCode = 401;
            message = 'Authentication required';
            shouldLog = true;
            includeDetails = false;
        } else if (error.name === 'ForbiddenError' || error.status === 403) {
            statusCode = 403;
            message = 'Access denied';
            shouldLog = true;
            includeDetails = false;
        } else if (error.name === 'ValidationError') {
            statusCode = 400;
            message = 'Invalid input provided';
            shouldLog = false; // Validation errors are expected
            includeDetails = true;
        } else if (error.name === 'JsonWebTokenError') {
            statusCode = 401;
            message = 'Invalid authentication token';
            shouldLog = true;
            includeDetails = false;
        } else if (error.name === 'TokenExpiredError') {
            statusCode = 401;
            message = 'Authentication token expired';
            shouldLog = true;
            includeDetails = false;
        } else if (error.name === 'NotBeforeError') {
            statusCode = 401;
            message = 'Authentication token not yet active';
            shouldLog = true;
            includeDetails = false;
        } else if (error.status >= 400 && error.status < 500) {
            // Client errors
            statusCode = error.status;
            message = error.message || 'Request failed';
            shouldLog = error.status >= 401; // Log auth-related errors
            includeDetails = false;
        }

        // Log error if required
        if (shouldLog) {
            try {
                await logAuthEvent({
                    action: 'AUTH_ERROR',
                    error: error.message,
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
                    ip: clientIP,
                    userAgent,
                    path,
                    method,
                    statusCode
                });
            } catch (logError) {
                console.error('Failed to log auth error:', logError.message);
            }
        }

        // Build error response
        const errorResponse = {
            success: false,
            message,
            timestamp: new Date().toISOString(),
            path
        };

        // Include details in development or for validation errors
        if (includeDetails || process.env.NODE_ENV === 'development') {
            errorResponse.details = error.message;
            
            if (error.errors && Array.isArray(error.errors)) {
                errorResponse.validationErrors = error.errors;
            }
        }

        // Include request ID for debugging
        if (req.requestId) {
            errorResponse.requestId = req.requestId;
        }

        // Rate limiting headers for auth errors
        if (statusCode === 401 || statusCode === 403) {
            res.set('X-Auth-Error', 'true');
            res.set('X-Retry-After', '15'); // Suggest retry after 15 seconds
        }

        // Security headers
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('X-Frame-Options', 'DENY');
        res.set('X-XSS-Protection', '1; mode=block');

        res.status(statusCode).json(errorResponse);
    }

    /**
     * Handle JWT-specific errors
     */
    static handleJWTError(error, req, res, next) {
        if (error.name === 'JsonWebTokenError') {
            return AuthErrorHandler.handleAuthError(
                createHttpError(401, 'Invalid authentication token'),
                req, res, next
            );
        } else if (error.name === 'TokenExpiredError') {
            return AuthErrorHandler.handleAuthError(
                createHttpError(401, 'Authentication token expired'),
                req, res, next
            );
        } else if (error.name === 'NotBeforeError') {
            return AuthErrorHandler.handleAuthError(
                createHttpError(401, 'Authentication token not yet active'),
                req, res, next
            );
        }
        
        // Pass through other errors
        next(error);
    }

    /**
     * Handle validation errors
     */
    static handleValidationError(error, req, res, next) {
        if (error.name === 'ValidationError' || error.isJoi) {
            const validationErrors = error.details?.map(detail => ({
                field: detail.path?.join('.') || 'unknown',
                message: detail.message,
                value: detail.context?.value
            })) || [];

            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validationErrors,
                timestamp: new Date().toISOString(),
                path: req.path
            });
        }
        
        // Pass through other errors
        next(error);
    }

    /**
     * Handle business logic errors
     */
    static handleBusinessError(error, req, res, next) {
        // Business logic errors that should be communicated to user
        const businessErrorMessages = [
            'User account is not properly configured',
            'Brand not found',
            'Business is inactive',
            'User account has corrupted identity',
            'Brand not found for user',
            'Account temporarily locked',
            'Too many failed login attempts'
        ];

        const isBusinessError = businessErrorMessages.some(msg => 
            error.message.includes(msg)
        );

        if (isBusinessError) {
            const statusCode = error.status || 400;
            
            return res.status(statusCode).json({
                success: false,
                message: error.message,
                type: 'business_error',
                timestamp: new Date().toISOString(),
                path: req.path
            });
        }
        
        // Pass through other errors
        next(error);
    }

    /**
     * Wrap async functions to catch errors
     */
    static asyncHandler(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }

    /**
     * Create standardized error responses
     */
    static createErrorResponse(message, statusCode = 500, type = 'error', details = null) {
        return {
            success: false,
            message,
            type,
            details,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Handle success responses with consistent format
     */
    static createSuccessResponse(data, message = 'Success', statusCode = 200) {
        return {
            success: true,
            message,
            data,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Global error handler middleware
 */
const globalAuthErrorHandler = (error, req, res, next) => {
    // Check if response has already been sent
    if (res.headersSent) {
        return next(error);
    }

    // Handle different error types
    if (error.name === 'ValidationError' || error.isJoi) {
        return AuthErrorHandler.handleValidationError(error, req, res, next);
    } else if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
        return AuthErrorHandler.handleJWTError(error, req, res, next);
    } else {
        return AuthErrorHandler.handleAuthError(error, req, res, next);
    }
};

module.exports = {
    AuthErrorHandler,
    globalAuthErrorHandler
};
