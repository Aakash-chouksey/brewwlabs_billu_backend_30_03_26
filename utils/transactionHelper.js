/**
 * Transaction Helper - Production Grade
 * Safe transaction handling with proper error management
 * NEVER throws - always returns structured response
 */

const { Pool } = require('pg');

// Lazy load database config
let pool;
const getPool = () => {
  if (!pool) {
    const { neonConfig } = require('@neondatabase/serverless');
    const { PGHOST, PGDATABASE, PGUSER, PGPASSWORD } = process.env;
    
    pool = new Pool({
      host: PGHOST,
      database: PGDATABASE,
      user: PGUSER,
      password: PGPASSWORD,
      ssl: true,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
};

/**
 * Safe database query with logging
 * @param {Object} client - Database client
 * @param {string} query - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function safeQuery(client, query, params = []) {
  try {
    const startTime = Date.now();
    const result = await client.query(query, params);
    const duration = Date.now() - startTime;
    
    if (duration > 1000) {
      console.warn(`⏱️ Slow query (${duration}ms):`, query.substring(0, 100));
    }
    
    return { success: true, rows: result.rows, rowCount: result.rowCount };
  } catch (err) {
    console.error('❌ DB ERROR:', {
      query: query.substring(0, 200),
      params: params.map(p => typeof p === 'string' ? p.substring(0, 50) : p),
      message: err.message,
      code: err.code,
      timestamp: new Date().toISOString()
    });
    
    return { success: false, error: err.message, code: err.code };
  }
}

/**
 * Execute code within a transaction
 * NEVER throws - always returns { success, data } or { success: false, error }
 * @param {Function} callback - Async function receiving client
 * @returns {Promise<Object>} Transaction result
 */
async function withTransaction(callback) {
  const client = await getPool().connect();
  
  try {
    await client.query('BEGIN');
    console.log('🔄 Transaction started');
    
    const result = await callback(client);
    
    // Check if callback returned an error
    if (result && result.error) {
      await client.query('ROLLBACK');
      console.log('↩️ Transaction rolled back due to error:', result.error);
      return { success: false, error: result.error };
    }
    
    await client.query('COMMIT');
    console.log('✅ Transaction committed');
    return { success: true, data: result };
    
  } catch (error) {
    await client.query('ROLLBACK').catch(err => {
      console.error('❌ Rollback failed:', err.message);
    });
    
    console.error('❌ TRANSACTION ERROR:', {
      message: error.message,
      stack: error.stack?.split('\n')[0],
      timestamp: new Date().toISOString()
    });
    
    return { success: false, error: error.message };
    
  } finally {
    client.release();
    console.log('🔓 Client released');
  }
}

/**
 * Execute code within a SAVEPOINT (nested transaction)
 * @param {Object} client - Parent transaction client
 * @param {Function} callback - Async function
 * @returns {Promise<Object>} Savepoint result
 */
async function withSavepoint(client, callback) {
  const savepointId = `sp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    await client.query(`SAVEPOINT ${savepointId}`);
    const result = await callback();
    await client.query(`RELEASE SAVEPOINT ${savepointId}`);
    return { success: true, data: result };
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepointId}`);
    return { success: false, error: error.message };
  }
}

/**
 * Health check for database connection
 * @returns {Promise<Object>} Health status
 */
async function healthCheck() {
  try {
    const client = await getPool().connect();
    const result = await client.query('SELECT NOW() as now');
    client.release();
    
    return {
      healthy: true,
      timestamp: result.rows[0].now,
      message: 'Database connected'
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      message: 'Database connection failed'
    };
  }
}

module.exports = {
  withTransaction,
  withSavepoint,
  safeQuery,
  healthCheck,
  getPool
};
