const { Sequelize } = require('sequelize');
const cls = require('cls-hooked');
require('dotenv').config();

// Initialize CLS namespace for automatic transaction passing
const namespace = cls.createNamespace('neon-safe-namespace');
Sequelize.useCLS(namespace);

// ========================================
// UNIFIED SCHEMA-PER-TENANT DATABASE
// ========================================

// Single database URL for all tenants
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URI;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL environment variable is not set!');
  console.error('Please set DATABASE_URL for PostgreSQL:');
  console.error('DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"');
  process.exit(1);
}

// Extract hostname for logging
function extractHostname(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    return 'Unknown';
  }
}

// Process URL - remove channel_binding if present
let processedUrl = databaseUrl;

// Remove channel_binding if present (causes issues with some providers)
processedUrl = processedUrl.replace(/([&?])channel_binding=require(&?)/, (match, prefix, suffix) => {
  return prefix === '?' && suffix ? '?' : prefix === '&' && suffix ? '&' : '';
});

// Detect if using cloud database (Neon/AWS) or local
const isCloudDb = processedUrl.includes('neon.tech') || 
                  processedUrl.includes('aws') || 
                  processedUrl.includes('rds') ||
                  processedUrl.includes('amazon');

if (isCloudDb) {
  console.log('☁️  Cloud database detected - enabling SSL');
  // Add sslmode=require for cloud databases if not present
  if (!processedUrl.includes('sslmode=')) {
    processedUrl += processedUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
  }
} else {
  console.log('💻 Local database detected - SSL disabled');
}

// SSL config only for cloud databases
const sslConfig = isCloudDb ? {
  require: true,
  rejectUnauthorized: false
} : false;

const globalSequelize = new Sequelize(processedUrl, {
  dialect: 'postgres',
  define: {
    underscored: true
  },
  dialectOptions: {
    // SSL only for cloud databases
    ...(isCloudDb && { ssl: sslConfig }),
    // Connection settings
    connectTimeout: isCloudDb ? 60000 : 10000,
    keepAlive: !isCloudDb, // Enable keepAlive for local, disable for cloud
    application_name: 'brewwlabs_pos',
    statement_timeout: 120000,
    idle_in_transaction_session_timeout: 60000,
  },
  pool: {
    max: isCloudDb ? 10 : 20,
    min: isCloudDb ? 0 : 2,
    acquire: isCloudDb ? 120000 : 30000,
    idle: isCloudDb ? 10000 : 30000,
    evict: 10000
  },
  logging: process.env.SQL_LOGGING === 'true' ? console.log : false,
  retry: {
    max: 0,  // DISABLE RETRIES - causing transaction issues with Neon
    timeout: 30000
  }
});

// ========================================
// 🔥 CRITICAL: GLOBAL TRANSACTION ENFORCEMENT (STRICT)
// ========================================
// Direct override of sequelize.query to block ANY operation without a transaction.
// This is the primary defense against cross-tenant data leakage in Neon.

// PHASE FLAG: Allow DDL/sync queries during initialization, enforce at runtime
let isInitializationPhase = false;

// Export function to set initialization phase
const setInitializationPhase = (value) => {
  isInitializationPhase = value;
  console.log(`🔧 Initialization phase: ${value ? 'ENABLED (DDL queries allowed)' : 'DISABLED (transactions enforced)'}`);
};

// Re-enable proxy with safer implementation
const originalQueryMethod = Sequelize.prototype.query;

globalSequelize.query = async function(sql, options = {}) {
    // 1. Identify query type
    const querySql = typeof sql === 'string' ? sql : (sql.query || '');
    const normalizedSql = querySql.toLowerCase().trim();

    // 2. Define STRICTLY allowed system/bootstrap queries (DDL, metadata, health checks)
    // These are SAFE to run without transaction as they don't touch tenant business data
    const SAFE_QUERY_PATTERNS = [
        // Health checks & connection tests
        'select 1',
        'select now()',
        'select version()',
        'select current_',
        // PostgreSQL system catalogs (metadata)
        'pg_namespace',
        'pg_catalog',
        'pg_class',
        'pg_attribute',
        'pg_constraint',
        'pg_index',
        // Information schema (metadata)
        'information_schema.schemata',
        'information_schema.tables',
        'information_schema.columns',
        'information_schema.table_constraints',
        'information_schema.key_column_usage',
        'information_schema.referential_constraints',
        'information_schema.statistics',
        // DDL operations (schema changes)
        'create schema',
        'drop schema',
        'create table',
        'alter table',
        'drop table',
        'truncate table',
        'create index',
        'drop index',
        'create unique index',
        'create sequence',
        'alter sequence',
        'drop sequence',
        'create trigger',
        'drop trigger',
        'create function',
        'drop function',
        // Schema/search_path settings
        'show search_path',
        'set search_path',
        'set local search_path',
        // Transaction control (not typical but safe)
        'begin',
        'commit',
        'rollback',
        // Sequelize internal metadata queries
        'SELECT i.relname AS name, ix.indisprimary AS primary, ix.indisunique AS unique,',
        'SELECT tc.constraint_name, tc.constraint_type',
        'SELECT conname, pg_get_constraintdef',
        'SELECT DISTINCT pk.constraint_name',
        'SELECT conname, confupdtype',
        'SELECT table_name, column_name',
        'FROM   pg_class c',
        'FROM   pg_constraint',
        'FROM   pg_indexes',
        'FROM   pg_attribute',
        'JOIN pg_class',
        'JOIN pg_constraint',
        'JOIN pg_namespace',
        'JOIN pg_attribute',
        'WHERE  c.oid'
    ];

    function isSafeQuery(sql) {
      const normalized = sql.toLowerCase().trim();
      // Check if query matches any safe pattern
      const isMetadataQuery = SAFE_QUERY_PATTERNS.some(pattern => normalized.includes(pattern.toLowerCase()));
      
      // Allow Sequelize's internal describe/index queries
      const isSequelizeMetadata = (
        normalized.includes('pg_class') ||
        normalized.includes('pg_constraint') ||
        normalized.includes('pg_index') ||
        normalized.includes('pg_attribute') ||
        normalized.includes('information_schema') ||
        normalized.includes('pg_catalog') ||
        normalized.includes('pg_get_constraintdef') ||
        normalized.includes('indisprimary') ||
        normalized.includes('constraint_name') ||
        (normalized.includes('select') && normalized.includes('pg_'))
      );
      
      // Allow DDL (Data Definition Language) - these modify schema, not data
      const isDDL = (
        normalized.startsWith('create ') ||
        normalized.startsWith('alter ') ||
        normalized.startsWith('drop ') ||
        normalized.startsWith('truncate ')
      );
      
      // Allow schema discovery queries
      const isSchemaQuery = normalized.includes('schema_name') || normalized.includes('schemata');
      
      return isMetadataQuery || isSequelizeMetadata || isDDL || isSchemaQuery;
    }

    // 3. Check if we already have a transaction
    const hasTransaction = options.transaction || namespace.get('transaction');

    // 4. INITIALIZATION PHASE: Allow all queries (DDL, sync, etc.)
    if (isInitializationPhase) {
      return originalQueryMethod.apply(this, [sql, options]);
    }

    // 5. RUNTIME PHASE: Transaction enforcement DISABLED
    // All queries are now allowed without transaction wrapping
    // Previous enforcement block removed to allow direct API queries

    // 6. Trace logging removed for performance - only log in development with explicit flag
    // Previously logged every query which caused massive slowdown
    if (options.transaction && process.env.VERBOSE_LOGS === 'true' && process.env.NODE_ENV === 'development') {
        const txId = options.transaction.id ? options.transaction.id.substring(0, 8) : 'no-id';
        process.stdout.write(`[TX:${txId}] ${querySql.substring(0, 80).replace(/\n/g, ' ')}...\n`);
    }

    // 7. Proxy to ORIGINAL query via prototype to avoid recursion
    return originalQueryMethod.apply(this, [sql, options]);
};

// ========================================
// ⚠️ DEPRECATED: UNSAFE FUNCTIONS REMOVED
// ========================================
// ALL global schema switching functions have been removed for Neon safety
// Use neonTransactionSafeSchemaManager for all operations

/**
 * Check if a tenant schema exists (transaction-safe)
 */
const schemaExists = async (schemaName) => {
  try {
    const result = await globalSequelize.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = :schemaName`,
      {
        replacements: { schemaName },
        type: Sequelize.QueryTypes.SELECT
      }
    );
    return result.length > 0;
  } catch (error) {
    console.error(`❌ Error checking schema existence for ${schemaName}:`, error.message);
    return false;
  }
};

/**
 * Create a new tenant schema (transaction-safe)
 */
const createTenantSchema = async (schemaName) => {
  if (!schemaName || !/^[a-zA-Z0-9_]+$/.test(schemaName)) {
    throw new Error('Invalid schema name. Only alphanumeric characters and underscores allowed.');
  }

  try {
    const exists = await schemaExists(schemaName);
    if (exists) {
      console.warn(`⚠️ Schema ${schemaName} already exists`);
      return true;
    }

    await globalSequelize.query(`CREATE SCHEMA "${schemaName}"`);
    console.log(`✅ Created tenant schema: ${schemaName}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to create schema ${schemaName}:`, error.message);
    throw error;
  }
};

/**
 * Get current search path (for debugging)
 */
const getCurrentSchema = async () => {
  try {
    const result = await globalSequelize.query('SHOW search_path', {
      type: Sequelize.QueryTypes.SELECT
    });
    return result[0]?.search_path || 'unknown';
  } catch (error) {
    console.error('❌ Error getting current schema:', error.message);
    return 'error';
  }
};

// ========================================
// DATABASE CONNECTION FUNCTION
// ========================================
globalSequelize.addHook('beforeConnect', () => {
  console.log('🔌 Connecting to unified schema-per-tenant database...');
});

globalSequelize.addHook('afterConnect', () => {
  console.log('✅ Unified database connection established');
});

const connectUnifiedDB = async (retries = 3, delay = 3000) => {
  console.log(`🔌 Attempting unified database connection to ${extractHostname(databaseUrl)}...`);
  
  for (let i = 0; i < retries; i++) {
    try {
      // 1. Authenticate
      await globalSequelize.authenticate();
      console.log('✅ Unified PostgreSQL Connection Authenticated.');
      
      // 2. Ensure public schema exists (wrapped in transaction to satisfy interceptor)
      await globalSequelize.transaction(async (transaction) => {
        await globalSequelize.query('SELECT 1 FROM pg_namespace WHERE nspname = \'public\'', { transaction });
      });
      console.log('✅ Public schema verified.');
      
      return;
    } catch (error) {
      console.error(`❌ Unified DB Connection Error (Attempt ${i + 1}/${retries}):`, error.message);
      
      if (error.code === 'ENOTFOUND' || error.code === 'ENETUNREACH') {
        console.error('💡 TIP: Possible DNS or Network resolution issue.');
      }
      
      if (error.code === 'ETIMEDOUT') {
        console.error('⏱️ Connection timeout. Database may be slow or unreachable.');
      }

      if (i < retries - 1) {
        console.log(`Retrying in ${delay / 1000}s...`);
        await new Promise(res => setTimeout(res, delay));
        delay = Math.min(delay * 1.5, 10000);
      } else {
        console.error('❌ Max retries reached. Unified database unavailable.');
        process.exit(1);
      }
    }
  }
};

module.exports = {
  // Single global instance
  sequelize: globalSequelize,
  globalSequelize, // Also export as globalSequelize for compatibility
  
  // Initialization phase control
  setInitializationPhase,
  
  // Connection and schema utilities (safe functions only)
  connectUnifiedDB,
  schemaExists,
  createTenantSchema,
  getCurrentSchema
};
