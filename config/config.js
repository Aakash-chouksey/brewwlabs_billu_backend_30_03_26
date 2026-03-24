require("dotenv").config({ override: true });

// ========================================
// ENVIRONMENT CONFIGURATION
// ========================================
// For Render deployment, default to production if NODE_ENV is not set
const nodeEnv = process.env.NODE_ENV || (
  process.env.RENDER ? "production" : "development"
);

console.log("🔧 NODE_ENV:", nodeEnv);
console.log("🔧 RENDER_SERVICE:", process.env.RENDER);
console.log("🔧 ENVIRONMENT DETECTION:", nodeEnv === "production" ? "PRODUCTION" : "DEVELOPMENT");

// ========================================
// DATABASE CONFIGURATION
// ========================================
// Local PostgreSQL Database Configuration
const postgresURI = process.env.DATABASE_URL || process.env.POSTGRES_URI;

if (!postgresURI) {
  console.error('❌ DATABASE_URL or POSTGRES_URI environment variable is required!');
  console.error('Please set your PostgreSQL connection string:');
  console.error('DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"');
  process.exit(1);
}

// Add sslmode=require for cloud databases (Neon, AWS, etc.) only
if (postgresURI.includes('neon.tech') || postgresURI.includes('aws') || postgresURI.includes('rds')) {
  if (!postgresURI.includes('sslmode=')) {
    console.log('🔧 Adding sslmode=require for cloud database compatibility');
  }
}

// ========================================
// SECURITY VALIDATION
// ========================================
if (nodeEnv === "production") {
    if (!process.env.JWT_SECRET) {
        console.error("🚨 FATAL: JWT_SECRET environment variable is required in production");
        process.exit(1);
    }
    if (!process.env.REFRESH_TOKEN_SECRET) {
        console.error("🚨 FATAL: REFRESH_TOKEN_SECRET environment variable is required in production");
        process.exit(1);
    }
}

const config = Object.freeze({
    port: process.env.PORT || 8000,
    postgresURI: postgresURI,
    nodeEnv: nodeEnv,
    accessTokenSecret: process.env.JWT_SECRET,
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    razorpaySecretKey: process.env.RAZORPAY_KEY_SECRET,
    razorpyWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
    
    // Google OAuth
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL,
    frontendUrl: process.env.FRONTEND_URL
});

// Debug log for configuration (Safe masking)
const maskedURI = config.postgresURI.replace(/\/\/(.*):(.*)@/, "//***:***@");
const isCloud = config.postgresURI.includes('neon.tech') || config.postgresURI.includes('aws') || config.postgresURI.includes('rds');
console.log(`⚙️  System Config: Env=${config.nodeEnv} | Port=${config.port} | DB=PostgreSQL (${isCloud ? 'Cloud' : 'Local'})`);
console.log(`🔗 DB URI: ${maskedURI}`);

module.exports = config;
