// ========================================
// FORCE IPv4 AND DNS CONFIGURATION
// ========================================
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

// ========================================
// LOAD ENVIRONMENT AND DEPENDENCIES
// ========================================
require('dotenv').config();
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const compression = require('compression');

// Import unified components
const { connectUnifiedDB } = require('./config/unified_database');
const { validateControlPlane } = require('./config/database_postgres');
const { applyNeonSafeMiddlewareChains } = require('./src/architecture/neonSafeMiddlewareChain');
const { globalErrorHandler } = require('./middlewares/globalErrorHandlers');

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
// HEALTH CHECK ENDPOINTS
// ========================================
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    architecture: 'schema-per-tenant'
  });
});

app.get('/health/detailed', async (req, res) => {
  try {
    const unifiedModelManager = require('./src/services/unifiedModelManager');
    const modelStats = unifiedModelManager.getStats();
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      architecture: 'schema-per-tenant',
      models: modelStats,
      memory: process.memoryUsage(),
      version: '2.0.0-unified'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error: error.message
    });
  }
});

// ========================================
// DATABASE CONNECTIONS
// ========================================
const initializeDatabases = async () => {
  try {
    console.log('🔌 Initializing database connections...');
    
    // 1. Connect to unified schema-per-tenant database
    await connectUnifiedDB();
    
    // 2. Validate control plane database
    await validateControlPlane();
    
    console.log('✅ All database connections established');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  }
};

// ========================================
// APPLY UNIFIED MIDDLEWARE CHAINS
// ========================================
const initializeApp = async () => {
  try {
    // Initialize databases first
    await initializeDatabases();
    
    // Apply unified middleware chains
    await applyNeonSafeMiddlewareChains(app);
    
    console.log('✅ Unified application initialized successfully');
  } catch (error) {
    console.error('❌ Application initialization failed:', error.message);
    process.exit(1);
  }
};

// ========================================
// GLOBAL ERROR HANDLER
// ========================================
app.use(globalErrorHandler);

// ========================================
// 404 HANDLER
// ========================================
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      '/health',
      '/api/auth/*',
      '/api/admin/*', 
      '/api/onboarding/business',

      '/api/tenant/*',
      '/api/inventory/*',
      '/api/user/*'
    ]
  });
});

// ========================================
// START SERVER
// ========================================
const startServer = async () => {
  try {
    await initializeApp();
    
    server.listen(PORT, () => {
      console.log(`🚀 Unified Server running on port ${PORT}`);
      console.log(`📋 Environment: ${process.env.NODE_ENV}`);
      console.log(`🏗️ Architecture: Schema-per-Tenant`);
      console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
      console.log(`📊 Detailed Health: http://localhost:${PORT}/health/detailed`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
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

// Start the server
startServer();

module.exports = app;
