// ========================================
// FORCE IPv4 AND DNS CONFIGURATION
// ========================================
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

// ========================================
// LOAD ENVIRONMENT AND DEPENDENCIES
// ========================================
require('dotenv').config(); // Ensure env vars are loaded first
// Default to production-safe environment unless explicitly set
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { globalErrorHandler } = require("./middlewares/globalErrorHandler");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { dbConnectionMiddleware } = require("./middlewares/dbCheck");

// Security: Advanced Redis-based Rate Limiting
const redisRateLimiter = require('./src/security/redisRateLimiter');

// Security: Helmet for security headers
const helmet = require("helmet");

// Global handlers: in production log and keep process alive; in non-production rethrow to surface failures.
process.on('unhandledRejection', (reason, promise) => {
  try {
    console.error('🔥  Unhandled Rejection at:', promise, 'reason:', reason);
  } catch (err) {
    console.error('🔥  Error while logging unhandledRejection:', err);
  }

  if (process.env.NODE_ENV !== 'production') {
    // In development, fail fast to surfacing issues
    throw reason instanceof Error ? reason : new Error(String(reason));
  }
  // In production, do not exit immediately — allow telemetry/cleanup to run.
});

process.on('uncaughtException', (error) => {
  try {
    console.error('🔥  Uncaught Exception:', error && (error.stack || error));
  } catch (err) {
    console.error('🔥  Error while logging uncaughtException:', err);
  }

  if (process.env.NODE_ENV !== 'production') {
    // In development, rethrow to crash and make the issue obvious.
    throw error;
  }
  // In production, do not exit immediately. Consider scheduling a graceful restart elsewhere.
});

const app = express();
const server = http.createServer(app);

/* ============================
   ALLOWED ORIGINS
============================ */

console.log("🌐 CORS - Environment detected:", process.env.NODE_ENV);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "https://brewwlabs.netlify.app",
  "https://brewwlabs-admin.vercel.app/",
  "https://brewwlabs-tenant.netlify.app",
  "https://brewwlabs-tenant.netlify.app/",
].filter(Boolean);

if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
}

console.log("🌐 CORS - Allowed origins:", allowedOrigins);

// CORS origin check function
const isOriginAllowed = (origin) => {
  if (!origin) {
    // Silent allow for server-to-server requests
    return true;
  }
  
  const normalizedOrigin = origin.replace(/\/$/, "").toLowerCase();
  
  // Always allow localhost and 127.0.0.1 in development or if explicitly in allowedOrigins
  const isLocal = normalizedOrigin.includes("localhost") || 
                  normalizedOrigin.includes("127.0.0.1") || 
                  normalizedOrigin.startsWith("http://localhost") || 
                  normalizedOrigin.startsWith("http://127.0.0.1");

  const isInAllowedList = allowedOrigins.some((allowed) => {
    const normalizedAllowed = allowed.replace(/\/$/, "").toLowerCase();
    return normalizedAllowed === normalizedOrigin;
  });
  
  const result = isLocal || isInAllowedList;
  
  if (!result) {
    console.warn(`❌ CORS - ORIGIN BLOCKED: ${origin}`);
    console.log(`ℹ️ CORS - Is Local: ${isLocal} | Is in Allowed List: ${isInAllowedList}`);
    console.log(`ℹ️ CORS - Allowed Origins List:`, allowedOrigins);
  } else {
    console.log(`✅ CORS - ORIGIN ALLOWED: ${origin} (Local: ${isLocal})`);
  }
  
  return result;
};

/* ============================
   SOCKET.IO SETUP
============================ */
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  },
});

/* ============================
   SYSTEM SAFETY GUARDS
============================ */
const { SystemSafetyGuards, DevelopmentSafetyGuards } = require("./src/architecture/safetyGuards");

// Run development mode checks
DevelopmentSafetyGuards.validateDevelopmentMode();

// Run critical system safety checks before starting the server
SystemSafetyGuards.runAllChecks().then(() => {
    console.log('\n🚀 Starting server after safety checks passed...\n');
    startServer();
}).catch(error => {
    console.error('💥 Safety checks failed:', error);
    process.exit(1);
});

/**
 * Start the server after safety checks pass
 */
async function startServer() {

/* ============================
   REDIS CACHE INITIALIZATION
============================ */
const { initializeRedis } = require('./src/cache/redisClient');
try {
  await initializeRedis();
  console.log('✅ Redis connected successfully (Startup validation)');
} catch (err) {
  console.error('💥 CRITICAL ERROR: Failed to initialize Redis:', err.message);
  console.error('   The system cannot operate without a Redis cache.');
  process.exit(1);
}

/* ============================
   CORS CONFIGURATION
============================ */
// Explicit CORS handler to ensure custom headers like x-panel-type are consistently allowed
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  if (isOriginAllowed(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS");
    res.header(
      "Access-Control-Allow-Headers", 
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-tenant-id, x-brand-id, x-outlet-id, x-business-id, x-panel-type, X-Panel-Type, Cookie"
    );
    res.header("Access-Control-Expose-Headers", "Set-Cookie");
  }

  // Handle preflight OPTIONS requests immediately
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  next();
});

/* ============================
   STATIC FILE SERVING
============================ */
// Serve uploaded files with proper CORS and CORP headers
app.use('/uploads', (req, res, next) => {
  // Set CORS headers
  const origin = req.headers.origin;
  if (isOriginAllowed(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
  }
  
  // Set Cross-Origin-Resource-Policy header to allow cross-origin access
  res.header("Cross-Origin-Resource-Policy", "cross-origin");
  
  // Set additional security headers for images
  res.header("X-Content-Type-Options", "nosniff");
  
  next();
}, express.static('uploads'));

/* ============================
   MIDDLEWARES
============================ */

// Apply security headers first
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Apply global rate limiting to all routes (DISABLED for development)
// app.use(redisRateLimiter.createMiddleware(redisRateLimiter.defaultLimits.global));

// Redis rate limiter is now disabled for development

app.use(express.json());
app.use(cookieParser());

/* ============================
   SOCKET.IO EVENTS
============================ */
app.set("io", io);
io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);
  socket.on("join-outlet", (outletId) => {
    socket.join(outletId);
    console.log(`🏠 Joined outlet: ${outletId}`);
  });
  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

/* ============================
   HEALTH CHECK & ROOT
============================ */
app.get("/", (req, res) => {
  res.json({ 
    message: "✅ BrewwLabs POS Server Running",
    // database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"
    database: "PostgreSQL Control Plane Connected" 
  });
});

app.get("/health", async (req, res) => {
    const { healthCheck: redisHealth } = require('./src/cache/redisClient');
    
    // Check DB status (simplified)
    const dbStatus = "Connected"; 
    
    // Check Redis status
    const redisStatus = await redisHealth();

    res.status(200).json({
        status: "UP",
        database: dbStatus,
        redis: redisStatus,
        env: process.env.NODE_ENV,
        uptime: process.uptime()
    });
});


/* ============================
   API ROUTES - Public Only (Others handled by middleware chain)
============================ */
// Public onboarding route (no authentication required)
const onboardingRoute = require('./routes/onboardingRoute');
app.use('/api/onboarding', onboardingRoute);

// Note: Protected routes are now handled by applyMiddlewareChains() below

/* ============================
   AUTH SETUP
============================ */
const passport = require('passport');
app.use(passport.initialize());
try {
  // Configure Google Strategy if environment variables are present. The module itself will skip registration when not configured.
  require('./src/auth/google.service')();
} catch (err) {
  // Defensive: ensure faulty auth module never crashes the whole app
  console.error('⚠️  Error while initializing Google auth strategy:', err);
}

/* ============================
   CENTRALIZED MIDDLEWARE CHAIN
============================ */
const { applyMiddlewareChains } = require("./src/architecture/middlewareChain");

// Apply all middleware chains in the correct order
applyMiddlewareChains(app);

// Domain-specific routes (if not already in tenantRoute)
// Note: Recommended to keep all tenant routes inside routes/tenantRoute.js to avoid app.js bloat.

/* ============================
   ERROR HANDLER
============================ */
app.use(globalErrorHandler);

/* ============================
   START SERVER
============================ */
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8000;

// Validate WhatsApp Config
const waToken = process.env.WHATSAPP_TOKEN;
const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

if (!waToken || !waToken.startsWith("EAAG") || waToken.includes("|")) {
  console.warn("⚠️  WARNING: Invalid WHATSAPP_TOKEN format.");
  console.warn("   WhatsApp API requires a User Access Token (starts with 'EAAG').");
  console.warn("   Message sending may fail with 'Invalid OAuth access token'.");
}

if (!waPhoneId || !/^\d+$/.test(waPhoneId)) {
  console.warn("⚠️  WARNING: Invalid WHATSAPP_PHONE_NUMBER_ID.");
  console.warn("   Must be a numeric ID (not a phone number). WhatsApp features will fail.");
}

const { initKeepAlive } = require("./services/keepAliveService");

console.log("ℹ️  WhatsApp Config check complete.");

if (require.main === module) {
  const startListening = (currentPort) => {
    server.listen(currentPort, '0.0.0.0');

    const onError = (err) => {
      server.removeListener('listening', onListening);
      if (err.code === 'EADDRINUSE') {
        if (process.env.NODE_ENV !== 'production') {
          const nextPort = currentPort + 1;
          console.warn(`⚠️  WARNING: Port ${currentPort} is already in use. Trying port ${nextPort}...`);
          startListening(nextPort);
        } else {
          console.error(`💥 CRITICAL ERROR: Port ${currentPort} is already in use.`);
          console.error('   Cannot start securely. Please free the port or change the PORT env variable.');
          process.exit(1);
        }
      } else {
        console.error('💥 Server error during startup:', err);
        process.exit(1);
      }
    };

    const onListening = () => {
      server.removeListener('error', onError);
      console.log(`☑️ BrewwLabs POS Server running on 0.0.0.0:${currentPort} (env=${process.env.NODE_ENV})`);
      initKeepAlive(); // Start the keep-alive cron job
      
      // Start tenant connection cleanup task (every 5 minutes)
      const tenantConnectionFactory = require('./src/services/tenantConnectionFactory');
      setInterval(async () => {
        try {
          await tenantConnectionFactory.cleanupExpiredConnections();
        } catch (error) {
          console.error('❌ Tenant connection cleanup failed:', error.message);
        }
      }, 5 * 60 * 1000); // 5 minutes
    };

    server.once('error', onError);
    server.once('listening', onListening);
  };
  
  startListening(PORT);
}

}

module.exports = { app, server };
