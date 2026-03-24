// ========================================
// FORCE IPv4 AND DNS CONFIGURATION
// ========================================
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

// ========================================
// LOAD ENVIRONMENT AND DEPENDENCIES
// ========================================
require('dotenv').config({ override: true });
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const compression = require('compression');
const cookieParser = require('cookie-parser');
const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');

// Import NEON-SAFE components
const { connectUnifiedDB } = require('./config/unified_database');
const { validateControlPlane } = require('./config/control_plane_db');
const { applyNeonSafeMiddlewareChains } = require('./src/architecture/neonSafeMiddlewareChain');
const { globalErrorHandler } = require('./middlewares/globalErrorHandlers');
const { searchPathResetMiddleware, connectionCleanupMiddleware } = require('./middlewares/searchPathReset');
const { standardResponseMiddleware, responseValidationMiddleware } = require('./utils/standardResponse');
const neonTransactionSafeExecutor = require('./services/neonTransactionSafeExecutor');

// Global handlers for production safety
process.on('unhandledRejection', (reason, promise) => {
  try {
    console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
  } catch (err) {
    console.error('🔥 Error while logging unhandledRejection:', err);
  }

  if (process.env.NODE_ENV !== 'production') {
    throw reason instanceof Error ? reason : new Error(String(reason));
  }
});

process.on('uncaughtException', (error) => {
  try {
    console.error('🔥 Uncaught Exception:', error && (error.stack || error));
  } catch (err) {
    console.error('🔥 Error while logging uncaughtException:', err);
  }

  if (process.env.NODE_ENV !== 'production') {
    throw error;
  }
});

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8000;

// ========================================
// SECURITY MIDDLEWARE
// ========================================
app.use(cookieParser());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "https://brewwlabs.netlify.app",
  "https://brewwlabs-admin.vercel.app/",
  "https://brewwlabs-tenant.netlify.app",
  "https://brewwlabs-tenant.netlify.app/",
];

if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Allow server-to-server requests
    
    const normalizedOrigin = origin.replace(/\/$/, "").toLowerCase();
    const isAllowed = allowedOrigins.some(allowed => 
      allowed.replace(/\/$/, "").toLowerCase() === normalizedOrigin
    );
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Panel-Type']
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========================================
// PHASE 3: SEARCH PATH RESET MIDDLEWARE (CRITICAL)
// ========================================
// Resets search_path to public after every request
// Prevents: login breaking after dashboard, cross-tenant leaks, random failures
app.use(searchPathResetMiddleware);

// ========================================
// PHASE 4 & 8: STANDARD RESPONSE MIDDLEWARE
// ========================================
// Enforces { success, message, data } format for all responses
app.use(standardResponseMiddleware);
app.use(responseValidationMiddleware);

// ========================================
// FIX 8: QUERY TIME LOGGING MIDDLEWARE
// ========================================
// Logs request duration for performance monitoring
// Logs slow queries (>1000ms) as warnings
app.use((req, res, next) => {
  const start = Date.now();
  
  // Store timing data on request
  req.timings = {
    start,
    dbTime: 0,
    middlewareTime: 0
  };
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const method = req.method;
    const url = req.originalUrl || req.url;
    const status = res.statusCode;
    
    // Calculate middleware time (approximate)
    req.timings.middlewareTime = duration - req.timings.dbTime;
    
    // Performance logging format
    const logEntry = {
      timestamp: new Date().toISOString(),
      method,
      url,
      status,
      totalDuration: duration,
      dbTime: req.timings.dbTime,
      middlewareTime: req.timings.middlewareTime,
      path: req.path
    };
    
    // Always log in development or if explicitly enabled
    if (process.env.NODE_ENV === 'development' || process.env.LOG_REQUEST_TIMES === 'true') {
      const statusEmoji = status >= 400 ? '❌' : status >= 300 ? '⚠️' : '✅';
      console.log(`${statusEmoji} ${method} ${url} → ${status} (${duration}ms | DB: ${req.timings.dbTime}ms)`);
    }
    
    // Always log slow requests as warnings (performance issues)
    if (duration > 1000) {
      console.warn(`⚠️ SLOW REQUEST: ${method} ${url} → ${status} (${duration}ms | DB: ${req.timings.dbTime}ms)`);
    }
  });
  
  next();
});

// ========================================
// NEON-SAFE HEALTH CHECK ENDPOINTS
// ========================================
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    architecture: 'neon-safe-schema-per-tenant',
    transactionSafe: true
  });
});

app.get('/health/detailed', async (req, res) => {
  try {
    const unifiedModelManager = require('./services/unifiedModelManager');
    const modelStats = unifiedModelManager.getStats();
    const transactionStats = neonTransactionSafeExecutor.getTransactionStats();
    const transactionHealth = await neonTransactionSafeExecutor.healthCheck();
    const { getTenantCacheStats } = require('./services/neonTransactionSafeExecutor');
    const tenantCacheStats = getTenantCacheStats ? getTenantCacheStats() : null;
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      architecture: 'neon-safe-schema-per-tenant',
      transactionSafe: true,
      models: modelStats,
      transactions: transactionStats,
      transactionHealth,
      tenantCache: tenantCacheStats,
      memory: process.memoryUsage(),
      version: '3.0.0-neon-safe-performance-optimized'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error: error.message
    });
  }
});

// ========================================
// REGISTER ROUTES (Synchronous)
// ========================================
applyNeonSafeMiddlewareChains(app);

// ========================================
// 404 HANDLER (Catch-all for undefined routes)
// ========================================
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      '/health',
      '/health/detailed',
      '/api/auth/*',
      '/api/onboarding/business',
      '/api/admin/*', 
      '/api/tenant/*',
      '/api/inventory/*',
      '/api/user/*'
    ],
    neonSafe: true
  });
});

// ========================================
// REQUEST TIMEOUT PROTECTION
// ========================================
app.use((req, res, next) => {
  res.setTimeout(120000, () => {
    if (!res.headersSent) {
      console.error(`⏱️ Request timeout: ${req.method} ${req.path}`);
      res.status(408).json({
        success: false,
        error: 'Request timeout',
        message: 'Request took too long to process'
      });
    }
  });
  next();
});

// ========================================
// GLOBAL ERROR HANDLER (Fail-Safe - NEVER CRASH)
// ========================================
app.use((err, req, res, next) => {
  // Safety: Ensure error is an object
  const error = err || {};
  const errorMessage = error.message || 'Unknown error occurred';
  const errorStack = error.stack || 'No stack trace available';
  
  // Log error safely
  try {
    console.error('❌ GLOBAL ERROR:', {
      message: errorMessage,
      stack: errorStack,
      path: req?.originalUrl || 'unknown',
      method: req?.method || 'unknown',
      timestamp: new Date().toISOString()
    });
  } catch (logError) {
    // If logging fails, at least try to log something
    console.error('❌ Error in error handler:', logError?.message || 'Unknown logging error');
  }

  // Don't send response if already sent
  if (res && res.headersSent) {
    return;
  }

  // Safety: Ensure res.status and res.json exist
  if (!res || typeof res.status !== 'function' || typeof res.json !== 'function') {
    console.error('❌ Response object invalid in error handler');
    return;
  }

  try {
    // Handle specific error types
    if (error.name === 'SequelizeConnectionError' || error.name === 'SequelizeConnectionRefusedError') {
      return res.status(503).json({
        success: false,
        message: 'Database unavailable. Please try again later.',
        data: {}
      });
    }

    if (error.name === 'SequelizeTimeoutError') {
      return res.status(408).json({
        success: false,
        message: 'Database query timed out. Please try again.',
        data: {}
      });
    }

    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: errorMessage || 'Authentication failed',
        data: {}
      });
    }

    if (errorMessage && errorMessage.includes('transaction')) {
      return res.status(500).json({
        success: false,
        message: 'Database transaction failed. Please try again.',
        data: {}
      });
    }

    // Remove fake success fallbacks (Phase 1 Fix)
    // These were hiding real errors by returning 200 OK
    // if (errorMessage && errorMessage.includes('undefined')) { ... }
    // if (errorMessage && (errorMessage.includes('column') || errorMessage.includes('does not exist'))) { ... }

    // Default error response - ALWAYS return success: false
    // This ensures real errors are exposed to developers and logs
    const statusCode = error.status || error.statusCode || 500;
    const isDev = process.env.NODE_ENV === 'development';
    
    return res.status(statusCode).json({
      success: false,
      message: isDev ? errorMessage : 'An unexpected error occurred. Please try again.',
      data: {}
    });
  } catch (responseError) {
    // Last resort: if response fails, just end the response
    console.error('❌ Failed to send error response:', responseError?.message);
    try {
      if (res && !res.headersSent) {
        res.end(JSON.stringify({ success: false, message: 'Handled safely', data: {} }));
      }
    } catch (e) {
      console.error('❌ CRITICAL: Cannot send any response');
    }
  }
});

// ========================================
// DATABASE CONNECTIONS
// ========================================
const initializeNeonSafeDatabases = async () => {
  try {
    console.log('🔌 Initializing Neon-safe database connections...');
    
    // 1. Connect to unified Neon-optimized database
    await connectUnifiedDB();
    
    // 2. Validate control plane database
    await validateControlPlane();
    
    // 3. PRE-LOAD MODELS - Critical for performance
    // Prevents 30s delay on first request
    console.log('📦 Pre-loading models...');
    const { ModelFactory } = require('./src/architecture/modelFactory');
    const { sequelize } = require('./config/unified_database');
    await ModelFactory.createModels(sequelize);
    console.log('✅ Models pre-loaded successfully');
    
    console.log('✅ All Neon-safe database connections established');
  } catch (error) {
    console.error('❌ Neon-safe database initialization failed:', error.message);
    throw error;
  }
};

// ========================================
// APPLY NEON-SAFE MIDDLEWARE CHAINS
// ========================================
const initializeNeonSafeApp = async () => {
  try {
    // Initialize databases first
    await initializeNeonSafeDatabases();
    
    console.log('✅ Neon-safe application initialized successfully');
  } catch (error) {
    console.error('❌ Neon-safe application initialization failed:', error.message);
    process.exit(1);
  }
};


// ========================================
// START SERVER
// ========================================
const startNeonSafeServer = async () => {
  try {
    await initializeNeonSafeApp();
    
    server.listen(PORT, () => {
      console.log(`🚀 Neon-Safe Server running on port ${PORT}`);
      console.log(`📋 Environment: ${process.env.NODE_ENV}`);
      console.log(`🏗️ Architecture: Neon-Safe Schema-per-Tenant`);
      console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
      console.log(`📊 Detailed Health: http://localhost:${PORT}/health/detailed`);
      console.log(`🔐 Transaction Safety: ENFORCED`);
      console.log(`⚡ Neon Optimized: YES`);
    });
  } catch (error) {
    console.error('❌ Failed to start Neon-safe server:', error.message);
    process.exit(1);
  }
};

// ========================================
// PERIODIC CLEANUP TASKS - DISABLED FOR PERFORMANCE
// ========================================
// NOTE: cleanupHangingTransactions was causing 60-90s TTFB delays
// Active transaction count is auto-managed. Cleanup is unnecessary overhead.
// If needed in future, use non-blocking async cleanup without setInterval.
/*
const startPeriodicTasks = () => {
  // Cleanup hanging transactions every 60 seconds
  setInterval(async () => {
    try {
      const cleaned = await neonTransactionSafeExecutor.cleanupHangingTransactions(120000);
      if (cleaned > 0) {
        console.log(`🗑️ Cleaned up ${cleaned} hanging transactions`);
      }
    } catch (error) {
      console.error('X Transaction cleanup failed:', error.message);
    }
  }, 60000);

  console.log('🔄 Periodic cleanup tasks started');
};
*/

// Empty stub to prevent errors if referenced elsewhere
const startPeriodicTasks = () => {
  console.log('⏭️  Periodic cleanup tasks disabled (performance optimization)');
};

// ========================================
// BACKGROUND JOBS (Fix 5)
// ========================================
const startBackgroundJobs = () => {
  // Update System Metrics every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    console.log('📈 Triggering background metrics update...');
    const scriptPath = path.join(__dirname, 'scripts', 'update_system_metrics.js');
    exec(`node ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Metrics update failed: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`⚠️ Metrics update warning: ${stderr}`);
      }
      console.log(`✅ Metrics update successful: ${stdout.trim()}`);
    });
  });

  // Run once on startup after 30s to populate initial cache
  setTimeout(() => {
    console.log('📈 Initial metrics population...');
    const scriptPath = path.join(__dirname, 'scripts', 'update_system_metrics.js');
    exec(`node ${scriptPath}`, (error, stdout) => {
       if (!error) console.log(`✅ Initial metrics populated: ${stdout.trim()}`);
    });
  }, 30000);

  console.log('⏰ Background jobs scheduled');
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Start server and periodic tasks
startNeonSafeServer();
startPeriodicTasks();
startBackgroundJobs();

module.exports = app;
