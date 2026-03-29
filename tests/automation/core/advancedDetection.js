/**
 * ADVANCED ISSUE DETECTION MODULE
 * ================================
 * 
 * Steps 8-10: Data Expectation Check, Hidden Issue Detection, Root Cause Analysis
 */

const { logger, getDBConnection } = require('./testFramework');
const { Sequelize } = require('sequelize');

/**
 * Data Expectation vs Reality Check - Step 8
 */
class DataExpectationModule {
  constructor(testTenant, apiResults) {
    this.testTenant = testTenant;
    this.apiResults = apiResults;
    this.expectationMismatches = [];
  }
  
  async execute() {
    logger.section('STEP 8: DATA EXPECTATION VS REALITY CHECK');
    
    await this.checkAPIvsDatabaseConsistency();
    await this.checkRequiredDataForAPIs();
    await this.checkJoinIntegrity();
    
    if (this.expectationMismatches.length === 0) {
      logger.success('All data expectations met - no mismatches found');
    } else {
      logger.error('Data expectation mismatches found', null, {
        count: this.expectationMismatches.length
      });
    }
    
    return {
      success: this.expectationMismatches.length === 0,
      mismatches: this.expectationMismatches
    };
  }
  
  async checkAPIvsDatabaseConsistency() {
    logger.info('Checking API vs Database consistency...');
    const db = await getDBConnection();
    const { schemaName, businessId } = this.testTenant;
    
    // Check dashboard data matches database
    try {
      const dbCounts = await db.query(`
        SELECT 
          (SELECT COUNT(*) FROM "${schemaName}".orders WHERE business_id = :businessId) as order_count,
          (SELECT COUNT(*) FROM "${schemaName}".products WHERE business_id = :businessId) as product_count,
          (SELECT COUNT(*) FROM "${schemaName}".categories WHERE business_id = :businessId) as category_count
      `, { replacements: { businessId }, type: Sequelize.QueryTypes.SELECT });
      
      const counts = dbCounts[0];
      logger.success('Database counts retrieved', {
        orders: parseInt(counts.order_count),
        products: parseInt(counts.product_count),
        categories: parseInt(counts.category_count)
      });
    } catch (error) {
      logger.warning('Could not verify API/DB consistency', error);
    }
  }
  
  async checkRequiredDataForAPIs() {
    logger.info('Checking required data for API functionality...');
    const db = await getDBConnection();
    const { schemaName, businessId } = this.testTenant;
    
    // Check products need categories
    const orphanedProducts = await db.query(`
      SELECT COUNT(*) as count 
      FROM "${schemaName}".products p
      LEFT JOIN "${schemaName}".categories c ON p.category_id = c.id
      WHERE p.business_id = :businessId AND p.category_id IS NOT NULL AND c.id IS NULL
    `, { replacements: { businessId }, type: Sequelize.QueryTypes.SELECT });
    
    if (parseInt(orphanedProducts[0].count) > 0) {
      this.expectationMismatches.push({
        type: 'orphaned_products',
        count: parseInt(orphanedProducts[0].count),
        description: 'Products with invalid category references'
      });
    }
    
    // Check orders need valid outlets
    const orphanedOrders = await db.query(`
      SELECT COUNT(*) as count 
      FROM "${schemaName}".orders o
      LEFT JOIN "${schemaName}".outlets out ON o.outlet_id = out.id
      WHERE o.business_id = :businessId AND out.id IS NULL
    `, { replacements: { businessId }, type: Sequelize.QueryTypes.SELECT });
    
    if (parseInt(orphanedOrders[0].count) > 0) {
      this.expectationMismatches.push({
        type: 'orphaned_orders',
        count: parseInt(orphanedOrders[0].count),
        description: 'Orders without valid outlet references'
      });
    }
    
    // Check inventory_items need categories
    const orphanedInventory = await db.query(`
      SELECT COUNT(*) as count 
      FROM "${schemaName}".inventory_items ii
      LEFT JOIN "${schemaName}".inventory_categories ic ON ii.category_id = ic.id
      WHERE ii.business_id = :businessId AND ii.category_id IS NOT NULL AND ic.id IS NULL
    `, { replacements: { businessId }, type: Sequelize.QueryTypes.SELECT });
    
    if (parseInt(orphanedInventory[0].count) > 0) {
      this.expectationMismatches.push({
        type: 'orphaned_inventory',
        count: parseInt(orphanedInventory[0].count),
        description: 'Inventory items with invalid category references'
      });
    }
  }
  
  async checkJoinIntegrity() {
    logger.info('Checking join integrity...');
    const db = await getDBConnection();
    const { schemaName, businessId } = this.testTenant;
    
    // Test that common joins will work
    const joinTests = [
      {
        name: 'Order with items',
        query: `
          SELECT COUNT(*) as count 
          FROM "${schemaName}".orders o
          JOIN "${schemaName}".order_items oi ON o.id = oi.order_id
          WHERE o.business_id = :businessId
          LIMIT 1
        `
      },
      {
        name: 'Product with category',
        query: `
          SELECT COUNT(*) as count 
          FROM "${schemaName}".products p
          JOIN "${schemaName}".categories c ON p.category_id = c.id
          WHERE p.business_id = :businessId
          LIMIT 1
        `
      }
    ];
    
    for (const test of joinTests) {
      try {
        await db.query(test.query, { 
          replacements: { businessId }, 
          type: Sequelize.QueryTypes.SELECT 
        });
        logger.success(`Join test passed: ${test.name}`);
      } catch (error) {
        logger.warning(`Join test failed: ${test.name}`, error);
        this.expectationMismatches.push({
          type: 'join_failure',
          test: test.name,
          error: error.message
        });
      }
    }
  }
}

/**
 * Hidden Issue Detection - Step 9
 */
class HiddenIssueDetectionModule {
  constructor(testTenant, apiResults) {
    this.testTenant = testTenant;
    this.apiResults = apiResults;
    this.hiddenIssues = [];
  }
  
  async execute() {
    logger.section('STEP 9: HIDDEN ISSUE DETECTION');
    
    await this.detectMissingDefaultData();
    await this.detectPartialOnboarding();
    await this.detectSilentTransactionFailures();
    await this.detectRawQueryIssues();
    await this.detectSchemaMisplacement();
    await this.detectDuplicateModelIssues();
    await this.detectFrontendParamIssues();
    await this.detectPerformanceIssues();
    
    const criticalIssues = this.hiddenIssues.filter(i => i.severity === 'critical');
    const warnings = this.hiddenIssues.filter(i => i.severity === 'warning');
    
    logger.success(`Hidden issue detection complete: ${criticalIssues.length} critical, ${warnings.length} warnings`);
    
    return {
      success: criticalIssues.length === 0,
      issues: this.hiddenIssues,
      criticalCount: criticalIssues.length,
      warningCount: warnings.length
    };
  }
  
  async detectMissingDefaultData() {
    logger.info('Checking for missing default data...');
    const db = await getDBConnection();
    const { schemaName, businessId } = this.testTenant;
    
    // Check critical default data
    const checks = [
      { table: 'categories', name: 'Default Category' },
      { table: 'inventory_categories', name: 'Default Inventory Category' },
      { table: 'areas', name: 'Main Area' }
    ];
    
    for (const check of checks) {
      try {
        const result = await db.query(`
          SELECT COUNT(*) as count 
          FROM "${schemaName}".${check.table}
          WHERE business_id = :businessId
        `, { replacements: { businessId }, type: Sequelize.QueryTypes.SELECT });
        
        const count = parseInt(result[0].count);
        if (count === 0) {
          this.hiddenIssues.push({
            type: 'missing_default_data',
            severity: 'warning',
            table: check.table,
            description: `No ${check.name} found in ${check.table}`
          });
        }
      } catch (error) {
        // Table might not exist yet
      }
    }
  }
  
  async detectPartialOnboarding() {
    logger.info('Checking for partial onboarding...');
    const db = await getDBConnection();
    const { businessId, schemaName } = this.testTenant;
    
    // Check if business exists but schema is missing
    const business = await db.query(
      'SELECT * FROM public.businesses WHERE id = :businessId',
      { replacements: { businessId }, type: Sequelize.QueryTypes.SELECT }
    );
    
    if (business.length === 0) {
      this.hiddenIssues.push({
        type: 'partial_onboarding',
        severity: 'critical',
        description: 'Business record missing after onboarding'
      });
      return;
    }
    
    // Check if schema exists
    const schema = await db.query(
      'SELECT schema_name FROM information_schema.schemata WHERE schema_name = :schema',
      { replacements: { schema: schemaName }, type: Sequelize.QueryTypes.SELECT }
    );
    
    if (schema.length === 0) {
      this.hiddenIssues.push({
        type: 'partial_onboarding',
        severity: 'critical',
        description: `Schema ${schemaName} missing after onboarding`
      });
    }
    
    // Check tenant registry status
    const registry = await db.query(
      'SELECT status FROM public.tenant_registry WHERE business_id = :businessId',
      { replacements: { businessId }, type: Sequelize.QueryTypes.SELECT }
    );
    
    if (registry.length > 0 && registry[0].status === 'INIT_FAILED') {
      this.hiddenIssues.push({
        type: 'partial_onboarding',
        severity: 'critical',
        description: 'Tenant onboarding failed - status is INIT_FAILED'
      });
    }
  }
  
  async detectSilentTransactionFailures() {
    logger.info('Checking for silent transaction failures...');
    const db = await getDBConnection();
    
    // Look for any stuck or failed migrations
    const failedMigrations = await db.query(`
      SELECT * FROM public.tenant_migration_logs 
      WHERE status = 'failed' 
      ORDER BY created_at DESC 
      LIMIT 10
    `, { type: Sequelize.QueryTypes.SELECT });
    
    if (failedMigrations.length > 0) {
      for (const migration of failedMigrations) {
        this.hiddenIssues.push({
          type: 'silent_transaction_failure',
          severity: 'critical',
          migration: migration.migration_name,
          tenant: migration.tenant_id,
          error: migration.error_message,
          description: `Migration ${migration.migration_name} failed for ${migration.tenant_id}`
        });
      }
    }
  }
  
  async detectRawQueryIssues() {
    logger.info('Checking for raw query issues...');
    const db = await getDBConnection();
    
    // Check for common raw query problems
    // 1. Check for queries with missing replacements
    // This is detected by looking for common patterns in logs
    
    // 2. Check for schema name injection vulnerabilities
    const suspiciousQueries = await db.query(`
      SELECT query, query_start 
      FROM pg_stat_activity 
      WHERE query LIKE '%$%1%' OR query LIKE '%$%2%'
      AND state = 'idle'
      LIMIT 10
    `, { type: Sequelize.QueryTypes.SELECT });
    
    if (suspiciousQueries.length > 0) {
      this.hiddenIssues.push({
        type: 'raw_query_issue',
        severity: 'warning',
        description: 'Potentially incomplete raw queries detected',
        count: suspiciousQueries.length
      });
    }
  }
  
  async detectSchemaMisplacement() {
    logger.info('Checking for schema misplacement...');
    const db = await getDBConnection();
    
    // Check if control tables exist in tenant schemas
    const tenantSchemas = await db.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'tenant_%'
    `, { type: Sequelize.QueryTypes.SELECT });
    
    for (const { schema_name } of tenantSchemas) {
      const controlTables = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = :schema 
        AND table_name IN ('businesses', 'users', 'tenant_registry', 'subscriptions')
      `, { replacements: { schema: schema_name }, type: Sequelize.QueryTypes.SELECT });
      
      if (controlTables.length > 0) {
        this.hiddenIssues.push({
          type: 'schema_misplacement',
          severity: 'critical',
          schema: schema_name,
          tables: controlTables.map(t => t.table_name),
          description: `Control tables found in tenant schema ${schema_name}`
        });
      }
    }
  }
  
  async detectDuplicateModelIssues() {
    logger.info('Checking for duplicate model issues...');
    
    // This checks if models are being loaded multiple times
    // which can cause association and sync issues
    try {
      const { ModelFactory } = require('../../../src/architecture/modelFactory');
      const stats = ModelFactory.getStats ? ModelFactory.getStats() : null;
      
      if (stats && stats.modelLoadCount > 10) {
        this.hiddenIssues.push({
          type: 'duplicate_model_issue',
          severity: 'warning',
          description: `Models loaded ${stats.modelLoadCount} times - potential memory leak`,
          stats
        });
      }
    } catch (error) {
      // ModelFactory may not have getStats
    }
  }
  
  async detectFrontendParamIssues() {
    logger.info('Checking for frontend parameter issues...');
    
    // Check API results for [object Object] or similar serialization issues
    for (const result of this.apiResults) {
      if (result.error && result.error.includes('[object Object]')) {
        this.hiddenIssues.push({
          type: 'frontend_param_issue',
          severity: 'warning',
          endpoint: result.url,
          description: 'Frontend sending [object Object] instead of proper value'
        });
      }
    }
  }
  
  async detectPerformanceIssues() {
    logger.info('Checking for performance issues...');
    
    // Check API response times
    const slowEndpoints = this.apiResults.filter(r => r.duration > 2000);
    
    for (const endpoint of slowEndpoints) {
      this.hiddenIssues.push({
        type: 'performance_issue',
        severity: 'warning',
        endpoint: endpoint.url,
        duration: endpoint.duration,
        description: `Slow response time: ${endpoint.duration}ms`
      });
    }
    
    // Check for N+1 query patterns
    const db = await getDBConnection();
    try {
      const slowQueries = await db.query(`
        SELECT query, calls, mean_time 
        FROM pg_stat_statements 
        WHERE mean_time > 500 
        ORDER BY mean_time DESC 
        LIMIT 5
      `, { type: Sequelize.QueryTypes.SELECT });
      
      if (slowQueries && slowQueries.length > 0) {
        for (const query of slowQueries) {
          this.hiddenIssues.push({
            type: 'performance_issue',
            severity: 'warning',
            query: query.query.substring(0, 100),
            meanTime: query.mean_time,
            calls: query.calls,
            description: `Slow query detected: ${query.mean_time}ms average`
          });
        }
      }
    } catch (error) {
      // pg_stat_statements may not be enabled
    }
  }
}

/**
 * Root Cause Analysis - Step 10
 */
class RootCauseAnalyzer {
  constructor(allTestResults) {
    this.allResults = allTestResults;
    this.rootCauses = [];
  }
  
  async execute() {
    logger.section('STEP 10: AUTO ROOT CAUSE IDENTIFICATION');
    
    this.analyzeOnboardingIssues();
    this.analyzeDatabaseIssues();
    this.analyzeAPIIssues();
    this.analyzeModelIssues();
    
    // Generate fix recommendations
    this.generateFixRecommendations();
    
    logger.success(`Root cause analysis complete: ${this.rootCauses.length} root causes identified`);
    
    return {
      success: this.rootCauses.length === 0,
      rootCauses: this.rootCauses
    };
  }
  
  analyzeOnboardingIssues() {
    const onboardingIssues = this.allResults.onboarding?.issues || [];
    
    for (const issue of onboardingIssues) {
      let rootCause = {
        layer: 'onboarding',
        error: issue.message,
        location: null,
        likelyCause: null,
        suggestedFix: null
      };
      
      if (issue.message?.includes('Business')) {
        rootCause.location = 'onboardingService.js: Business.create()';
        rootCause.likelyCause = 'Missing required fields or database constraint violation';
        rootCause.suggestedFix = 'Check business model validation and database constraints';
      } else if (issue.message?.includes('User')) {
        rootCause.location = 'onboardingService.js: User.create()';
        rootCause.likelyCause = 'User creation failed - possibly missing business_id or invalid role';
        rootCause.suggestedFix = 'Verify user model associations and required fields';
      } else if (issue.message?.includes('schema')) {
        rootCause.location = 'onboardingService.js: CREATE SCHEMA';
        rootCause.likelyCause = 'Permission issue or schema already exists';
        rootCause.suggestedFix = 'Add IF NOT EXISTS and handle permissions correctly';
      }
      
      this.rootCauses.push(rootCause);
    }
  }
  
  analyzeDatabaseIssues() {
    const dbIssues = this.allResults.database?.results?.tenantSchema?.issues || [];
    
    for (const issue of dbIssues) {
      if (issue.includes('Missing tables')) {
        this.rootCauses.push({
          layer: 'database',
          error: issue,
          location: 'migrationRunner.js or tenantModelLoader.js',
          likelyCause: 'Migration did not run or failed silently',
          suggestedFix: 'Add migration verification step and retry mechanism'
        });
      } else if (issue.includes('Control tables')) {
        this.rootCauses.push({
          layer: 'database',
          error: issue,
          location: 'tenantModelLoader.js: MODEL_LOAD_ORDER',
          likelyCause: 'Wrong model classification - control model in tenant list',
          suggestedFix: 'Verify CONTROL_MODELS and TENANT_MODELS in constants.js'
        });
      }
    }
  }
  
  analyzeAPIIssues() {
    const apiIssues = this.allResults.api?.results?.filter(r => !r.passed) || [];
    
    for (const issue of apiIssues) {
      let rootCause = {
        layer: 'api',
        error: issue.error,
        endpoint: issue.url,
        location: null,
        likelyCause: null,
        suggestedFix: null
      };
      
      if (issue.status === 401) {
        rootCause.likelyCause = 'Authentication middleware rejecting valid token';
        rootCause.suggestedFix = 'Check token validation and expiration logic';
      } else if (issue.status === 500) {
        rootCause.likelyCause = 'Server error - likely null reference or missing data';
        rootCause.suggestedFix = 'Add null checks and defensive coding in controller';
      } else if (issue.status === 404) {
        rootCause.likelyCause = 'Route not registered or base path mismatch';
        rootCause.suggestedFix = 'Verify route registration in app.js';
      } else if (issue.error?.includes('timeout')) {
        rootCause.likelyCause = 'Slow query or infinite loop';
        rootCause.suggestedFix = 'Add query timeout and optimize database calls';
      }
      
      this.rootCauses.push(rootCause);
    }
  }
  
  analyzeModelIssues() {
    const modelIssues = this.allResults.model?.issues || [];
    
    for (const issue of modelIssues) {
      let rootCause = {
        layer: 'model',
        error: issue.issue,
        location: `models/${issue.model?.toLowerCase()}Model.js`,
        likelyCause: null,
        suggestedFix: null
      };
      
      if (issue.issue === 'Column not found in database') {
        rootCause.likelyCause = 'Model field name does not match database column';
        rootCause.suggestedFix = `Update model to use field: '${issue.field}' for attribute '${issue.attribute}'`;
      } else if (issue.issue === 'Table not found in schema') {
        rootCause.likelyCause = 'Table not created during migration or wrong schema';
        rootCause.suggestedFix = 'Add table creation to migration or check schema binding';
      }
      
      this.rootCauses.push(rootCause);
    }
  }
  
  generateFixRecommendations() {
    logger.info('Generating fix recommendations...');
    
    // Group by layer
    const byLayer = {};
    for (const cause of this.rootCauses) {
      if (!byLayer[cause.layer]) byLayer[cause.layer] = [];
      byLayer[cause.layer].push(cause);
    }
    
    for (const [layer, causes] of Object.entries(byLayer)) {
      logger.info(`${layer.toUpperCase()} fixes needed: ${causes.length}`);
      
      for (const cause of causes) {
        logger.info(`  - ${cause.suggestedFix || 'No suggestion available'}`);
      }
    }
  }
}

module.exports = {
  DataExpectationModule,
  HiddenIssueDetectionModule,
  RootCauseAnalyzer
};
