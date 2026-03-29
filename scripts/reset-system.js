/**
 * STANDALONE SYSTEM RESET SCRIPT
 * ===============================
 * 
 * Run this to completely reset the system to a clean state
 * Usage: node scripts/reset-system.js [--force]
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const CONFIG = {
  DB_CONNECTION_STRING: process.env.DATABASE_URL || process.env.DB_CONNECTION_STRING,
  FORCE_MODE: process.argv.includes('--force'),
  PRESERVE_SYSTEM_SCHEMAS: ['public', 'information_schema', 'pg_catalog', 'pg_toast']
};

const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  success: (msg) => console.log(`[SUCCESS] ✅ ${msg}`),
  error: (msg, err) => console.error(`[ERROR] ❌ ${msg}`, err ? err.message : ''),
  warning: (msg) => console.warn(`[WARNING] ⚠️  ${msg}`),
  section: (title) => console.log(`\n${'='.repeat(60)}\n  ${title}\n${'='.repeat(60)}`)
};

class SystemReset {
  constructor() {
    this.sequelize = null;
    this.stats = {
      schemasDropped: 0,
      tablesTruncated: 0,
      usersDeleted: 0,
      businessesDeleted: 0
    };
  }

  async connect() {
    if (!CONFIG.DB_CONNECTION_STRING) {
      throw new Error('DATABASE_URL not set in environment');
    }

    this.sequelize = new Sequelize(CONFIG.DB_CONNECTION_STRING, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      }
    });

    await this.sequelize.authenticate();
    logger.success('Database connection established');
  }

  async execute() {
    logger.section('SYSTEM RESET UTILITY');
    
    if (!CONFIG.FORCE_MODE) {
      logger.warning('This will DELETE ALL DATA in tenant schemas and clear public tables!');
      logger.warning('Use --force flag to skip this warning and proceed');
      logger.info('Dry run mode - no changes will be made');
      console.log('\nTo actually reset, run: node scripts/reset-system.js --force\n');
      return { dryRun: true };
    }

    try {
      await this.connect();
      
      // Step 1: Drop all tenant schemas
      await this.dropTenantSchemas();
      
      // Step 2: Clear public tables
      await this.clearPublicTables();
      
      // Step 3: Reset sequences
      await this.resetSequences();
      
      // Step 4: Clear cache
      await this.clearCache();
      
      logger.section('RESET COMPLETE');
      console.log('Statistics:', this.stats);
      
      return { success: true, stats: this.stats };
      
    } catch (error) {
      logger.error('System reset failed', error);
      throw error;
    } finally {
      if (this.sequelize) {
        await this.sequelize.close();
      }
    }
  }

  async dropTenantSchemas() {
    logger.section('DROPPING TENANT SCHEMAS');
    
    const schemas = await this.sequelize.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'tenant_%'
      ORDER BY schema_name
    `, { type: Sequelize.QueryTypes.SELECT });

    logger.info(`Found ${schemas.length} tenant schemas`);

    for (const { schema_name } of schemas) {
      try {
        await this.sequelize.query(`DROP SCHEMA IF EXISTS "${schema_name}" CASCADE`);
        this.stats.schemasDropped++;
        logger.success(`Dropped schema: ${schema_name}`);
      } catch (error) {
        logger.error(`Failed to drop ${schema_name}`, error);
      }
    }

    logger.success(`Dropped ${this.stats.schemasDropped} schemas`);
  }

  async clearPublicTables() {
    logger.section('CLEARING PUBLIC TABLES');
    
    const tables = await this.sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('sequelize_meta', 'schema_migrations', 'knex_migrations')
      ORDER BY table_name
    `, { type: Sequelize.QueryTypes.SELECT });

    logger.info(`Found ${tables.length} tables in public schema`);

    // Disable foreign key checks temporarily
    try {
      await this.sequelize.query('SET session_replication_role = replica;');
    } catch (error) {
      logger.warning('Could not disable foreign key checks - will try CASCADE');
    }

    for (const { table_name } of tables) {
      try {
        await this.sequelize.query(`TRUNCATE TABLE "public"."${table_name}" CASCADE`);
        this.stats.tablesTruncated++;
        logger.success(`Truncated: ${table_name}`);
      } catch (error) {
        logger.error(`Failed to truncate ${table_name}`, error);
      }
    }

    // Re-enable foreign key checks
    try {
      await this.sequelize.query('SET session_replication_role = DEFAULT;');
    } catch (error) {
      // Ignore
    }

    // Get user/business counts for stats
    try {
      const userCount = await this.sequelize.query(
        'SELECT COUNT(*) as count FROM public.users',
        { type: Sequelize.QueryTypes.SELECT }
      );
      this.stats.usersDeleted = parseInt(userCount[0].count);
      
      const businessCount = await this.sequelize.query(
        'SELECT COUNT(*) as count FROM public.businesses',
        { type: Sequelize.QueryTypes.SELECT }
      );
      this.stats.businessesDeleted = parseInt(businessCount[0].count);
    } catch (error) {
      // Tables may not exist
    }

    logger.success(`Truncated ${this.stats.tablesTruncated} tables`);
  }

  async resetSequences() {
    logger.section('RESETTING SEQUENCES');
    
    try {
      const sequences = await this.sequelize.query(`
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'public'
      `, { type: Sequelize.QueryTypes.SELECT });

      for (const { sequence_name } of sequences) {
        try {
          await this.sequelize.query(`ALTER SEQUENCE "${sequence_name}" RESTART WITH 1`);
        } catch (error) {
          // Non-critical
        }
      }

      logger.success(`Reset ${sequences.length} sequences`);
    } catch (error) {
      logger.warning('Could not reset sequences');
    }
  }

  async clearCache() {
    logger.section('CLEARING CACHES');
    
    // Clear any in-memory caches
    try {
      // Import and clear tenant model cache
      const { tenantModelLoader } = require('../src/architecture/tenantModelLoader');
      if (tenantModelLoader && tenantModelLoader.clearCache) {
        tenantModelLoader.clearCache();
        logger.success('Cleared tenant model cache');
      }
    } catch (error) {
      // Module may not be available
    }

    // Clear any Redis cache if used
    try {
      const redis = require('../config/redis');
      if (redis && redis.flushdb) {
        await redis.flushdb();
        logger.success('Cleared Redis cache');
      }
    } catch (error) {
      // Redis may not be configured
    }
  }
}

// Run if executed directly
if (require.main === module) {
  const reset = new SystemReset();
  
  reset.execute().then(result => {
    if (result.dryRun) {
      process.exit(0);
    }
    if (result.success) {
      console.log('\n✅ System reset complete!');
      console.log('You can now start fresh onboarding and testing.\n');
      process.exit(0);
    } else {
      console.log('\n❌ System reset failed\n');
      process.exit(1);
    }
  }).catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { SystemReset };
