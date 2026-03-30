/**
 * ENHANCED ERROR HANDLING MIDDLEWARE
 * Multi-tenant POS System - March 2026
 * 
 * This middleware ensures no errors are silently swallowed
 * and provides comprehensive error logging and meaningful responses.
 */

const createHttpError = require("http-errors");

class EnhancedErrorHandler {
    constructor() {
        this.errorCounts = {};
        this.criticalErrors = [];
    }

    // Enhanced error handler that logs everything and prevents silent failures
    handleControllerError(error, req, res, next) {
        const errorId = this.generateErrorId();
        const timestamp = new Date().toISOString();
        
        // Log comprehensive error information
        this.logError(error, req, errorId, timestamp);
        
        // Track error patterns
        this.trackErrorPattern(error);
        
        // Send meaningful response
        this.sendErrorResponse(error, req, res, errorId);
        
        // Don't call next() to avoid multiple error handlers
    }

    logError(error, req, errorId, timestamp) {
        const errorInfo = {
            errorId,
            timestamp,
            message: error.message,
            stack: error.stack,
            statusCode: error.statusCode || error.status || 500,
            method: req.method,
            url: req.originalUrl,
            headers: {
                'x-outlet-id': req.headers['x-outlet-id'],
                'business-id': req.business_id || req.businessId,
                'user-agent': req.headers['user-agent']
            },
            body: req.method !== 'GET' ? this.sanitizeRequestBody(req.body) : null,
            params: req.params,
            query: req.query,
            user: req.user ? { id: req.user.id, email: req.user.email, role: req.user.role } : null
        };

        console.error(`🚨 [ERROR-${errorId}] CONTROLLER ERROR:`, JSON.stringify(errorInfo, null, 2));
        
        // Track critical errors
        if (error.statusCode >= 500 || error.statusCode === undefined) {
            this.criticalErrors.push(errorInfo);
        }
    }

    trackErrorPattern(error) {
        const errorType = error.constructor.name;
        const errorMessage = error.message;
        
        if (!this.errorCounts[errorType]) {
            this.errorCounts[errorType] = { count: 0, messages: [] };
        }
        
        this.errorCounts[errorType].count++;
        this.errorCounts[errorType].messages.push(errorMessage);
        
        // Alert on error patterns
        if (this.errorCounts[errorType].count >= 5) {
            console.error(`🚨 [PATTERN] High frequency error detected: ${errorType}`, {
                count: this.errorCounts[errorType].count,
                recentMessages: this.errorCounts[errorType].messages.slice(-5)
            });
        }
    }

    sendErrorResponse(error, req, res, errorId) {
        // Ensure we always send a response
        if (res.headersSent) {
            console.warn(`⚠️ [ERROR-${errorId}] Response already sent, skipping error response`);
            return;
        }

        const statusCode = error.statusCode || error.status || 500;
        const isClientError = statusCode < 500;
        
        // Client errors (4xx) - less detail, more user-friendly
        if (isClientError) {
            res.status(statusCode).json({
                success: false,
                error: {
                    code: this.getErrorCode(error),
                    message: this.getClientErrorMessage(error),
                    errorId: process.env.NODE_ENV === 'development' ? errorId : undefined
                },
                timestamp: new Date().toISOString()
            });
        } 
        // Server errors (5xx) - more detail for debugging
        else {
            res.status(statusCode).json({
                success: false,
                error: {
                    code: this.getErrorCode(error),
                    message: this.getServerErrorMessage(error),
                    errorId: process.env.NODE_ENV === 'development' ? errorId : undefined,
                    details: process.env.NODE_ENV === 'development' ? {
                        stack: error.stack,
                        request: {
                            method: req.method,
                            url: req.originalUrl,
                            headers: this.sanitizeHeaders(req.headers)
                        }
                    } : undefined
                },
                timestamp: new Date().toISOString()
            });
        }
    }

    getErrorCode(error) {
        // Map common errors to standardized codes
        if (error.name === 'ValidationError') return 'VALIDATION_ERROR';
        if (error.name === 'SequelizeValidationError') return 'DATABASE_VALIDATION_ERROR';
        if (error.name === 'SequelizeUniqueConstraintError') return 'DUPLICATE_ERROR';
        if (error.name === 'SequelizeForeignKeyConstraintError') return 'FOREIGN_KEY_ERROR';
        if (error.message && error.message.includes('not found')) return 'NOT_FOUND';
        if (error.message && error.message.includes('already occupied')) return 'TABLE_OCCUPIED';
        if (error.message && error.message.includes('required')) return 'REQUIRED_FIELD_MISSING';
        
        return 'INTERNAL_ERROR';
    }

    getClientErrorMessage(error) {
        // User-friendly error messages
        if (error.message && error.message.includes('not found')) {
            return 'The requested resource was not found';
        }
        if (error.message && error.message.includes('already occupied')) {
            return 'This table is already occupied by another order';
        }
        if (error.message && error.message.includes('required')) {
            return 'Required information is missing';
        }
        if (error.message && error.message.includes('Invalid')) {
            return error.message;
        }
        
        return 'An error occurred while processing your request';
    }

    getServerErrorMessage(error) {
        // More detailed error messages for server errors
        return error.message || 'An internal server error occurred';
    }

    sanitizeRequestBody(body) {
        if (!body) return null;
        
        // Remove sensitive information
        const sanitized = { ...body };
        if (sanitized.password) sanitized.password = '[REDACTED]';
        if (sanitized.token) sanitized.token = '[REDACTED]';
        if (sanitized.secret) sanitized.secret = '[REDACTED]';
        
        return sanitized;
    }

    sanitizeHeaders(headers) {
        const sanitized = { ...headers };
        if (sanitized.authorization) sanitized.authorization = '[REDACTED]';
        if (sanitized.cookie) sanitized.cookie = '[REDACTED]';
        
        return sanitized;
    }

    generateErrorId() {
        return `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    }

    // Wrap controller methods to ensure all errors are caught
    wrapControllerMethod(controllerMethod) {
        return async (req, res, next) => {
            try {
                // Add start time for performance tracking
                const startTime = Date.now();
                const method = req.method;
                const url = req.originalUrl;
                
                console.log(`🔍 [REQUEST] Starting: ${method} ${url}`);
                
                // Execute the controller method
                const result = await controllerMethod(req, res, next);
                
                // Log successful completion
                const duration = Date.now() - startTime;
                console.log(`✅ [REQUEST] Completed: ${method} ${url} in ${duration}ms`);
                
                return result;
                
            } catch (error) {
                console.log(`🚨 [REQUEST] Failed: ${req.method} ${req.originalUrl}`);
                this.handleControllerError(error, req, res, next);
            }
        };
    }

    // Generate error report
    generateErrorReport() {
        const report = {
            timestamp: new Date().toISOString(),
            errorCounts: this.errorCounts,
            criticalErrors: this.criticalErrors,
            summary: {
                totalErrors: Object.values(this.errorCounts).reduce((sum, type) => sum + type.count, 0),
                criticalErrorCount: this.criticalErrors.length,
                mostCommonError: this.getMostCommonError()
            }
        };

        console.log('\n' + '='.repeat(80));
        console.log('📊 ERROR HANDLING REPORT');
        console.log('='.repeat(80));
        console.log(JSON.stringify(report, null, 2));
        console.log('='.repeat(80));

        return report;
    }

    getMostCommonError() {
        let mostCommon = null;
        let highestCount = 0;

        for (const [errorType, data] of Object.entries(this.errorCounts)) {
            if (data.count > highestCount) {
                highestCount = data.count;
                mostCommon = { type: errorType, count: data.count };
            }
        }

        return mostCommon;
    }
}

// Singleton instance
const enhancedErrorHandler = new EnhancedErrorHandler();

// Middleware function
const enhancedErrorMiddleware = (err, req, res, next) => {
    enhancedErrorHandler.handleControllerError(err, req, res, next);
};

// Controller wrapper factory
const wrapController = (controllerFunction) => {
    return enhancedErrorHandler.wrapControllerMethod(controllerFunction);
};

// Export both middleware and wrapper
module.exports = {
    enhancedErrorHandler,
    enhancedErrorMiddleware,
    wrapController
};
