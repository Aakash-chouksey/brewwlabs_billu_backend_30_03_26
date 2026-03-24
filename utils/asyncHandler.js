/**
 * ASYNC HANDLER
 * 
 * Wraps async route handlers to catch errors and pass to error middleware
 * Prevents server crashes from unhandled promise rejections
 */

const asyncHandler = (fn) => async (req, res, next) => {
  try {
    // Check if response already sent before executing
    if (res.headersSent) {
      console.warn('⚠️ Response already sent before handler execution:', req.originalUrl);
      return;
    }
    
    await fn(req, res, next);
  } catch (err) {
    // Only send error response if headers haven't been sent yet
    if (!res.headersSent) {
      next(err);
    } else {
      // Log the error but don't try to send another response
      console.error('❌ Error after response sent:', {
        message: err.message,
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    }
  }
};

/**
 * Controller wrapper that ensures response is always sent safely
 */
const controllerWrapper = (fn) => asyncHandler(async (req, res) => {
  // Check if response already sent
  if (res.headersSent) {
    console.warn('⚠️ Headers already sent at controller start:', req.originalUrl);
    return;
  }
  
  const result = await fn(req, res);
  
  // Ensure we always return a response (only if not already sent)
  if (!res.headersSent) {
    if (result && result.error) {
      return res.status(result.status || 400).json({
        success: false,
        error: result.error,
        message: result.message || 'Request failed'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: result
    });
  }
});

module.exports = {
  asyncHandler,
  controllerWrapper
};
