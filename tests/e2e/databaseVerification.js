/**
 * Database Verification Module
 * Validates database state after onboarding
 */

const { Sequelize } = require('sequelize');
const { TEST_CONFIG, TEST_STATE } = require('./config');
const { TestUtils, TestLogger } = require('./utils');

class DatabaseVerification {
  constructor() {
    this.sequelize = null;
    this.schemaName = TEST_STATE.schemaName;
  }
  
  async initialize() {
    const dbUrl = TEST_CONFIG.getDatabaseUrl();
    if (!dbUrl) {
      throw new Error('DATABASE_URL not configured');
    }
    
    const isCloudDb = dbUrl.includes('neon.tech') || dbUrl.includes('aws');
    
    this.sequelize = new Sequelize(dbUrl, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ...(isCloudDb && {
          ssl: { require: true, rejectUnauthorized: false }
        })
      }
    });
    
    await this.sequelize.authenticate();
  }
  
  async run() {
    TestLogger.section('DATABASE VERIFICATION');
    const startTime = Date.now();
    
    try {
      await this.initialize();
      
      // Test 1: Verify public schema tables
      TestLogger.step(1, 'Verifying public schema tables');
      const publicTablesCheck = await this.verifyPublicTables();
      
      if (!publicTablesCheck.valid) {
        TestUtils.recordResult(
          'Public Schema Tables',
          'FAIL',
          'Missing required public tables',
          { missing: publicTablesCheck.missing },
          Date.now() - startTime
        );
      } else {
        TestUtils.recordResult(
          'Public Schema Tables',
          'PASS',
          `All ${TEST_CONFIG.requiredPublicTables.length} required tables present`
        );
      }
      
      // Test 2: Verify tenant_registry columns
      TestLogger.step(2, 'Verifying tenant_registry structure');
      const registryCheck = await this.verifyTenantRegistry();
      
      if (!registryCheck.valid) {
        TestUtils.recordResult(
          'Tenant Registry Structure',
          'FAIL',
          'Missing required columns',
          { missing: registryCheck.missing },
          Date.now() - startTime
        );
      } else {
        TestUtils.recordResult(
          'Tenant Registry Structure',
          'PASS',
          'All required columns present'
        );
      }
      
      // Test 3: Verify tenant schema exists
      TestLogger.step(3, 'Verifying tenant schema exists');
      const schemaCheck = await this.verifyTenantSchema();
      
      if (!schemaCheck.exists) {
        return TestUtils.recordResult(
          'Tenant Schema',
          'FAIL',
          `Schema ${this.schemaName} not found`,
          null,
          Date.now() - startTime
        );
      }
      
      TestUtils.recordResult(
        'Tenant Schema',
        'PASS',
        `Schema ${this.schemaName} exists`
      );
      
      // Test 4: Verify tenant schema tables
      TestLogger.step(4, 'Verifying tenant schema tables');
      const tenantTablesCheck = await this.verifyTenantTables();
      
      if (!tenantTablesCheck.valid) {
        TestUtils.recordResult(
          'Tenant Tables',
          'FAIL',
          'Missing required tenant tables',
          { missing: tenantTablesCheck.missing },
          Date.now() - startTime
        );
      } else {
        TestUtils.recordResult(
          'Tenant Tables',
          'PASS',
          `All ${TEST_CONFIG.requiredTenantTables.length} required tables present`
        );
      }
      
      // Test 5: Verify no control tables in tenant schema
      TestLogger.step(5, 'Checking for misplaced control tables');
      const controlTablesCheck = await this.checkControlTableMisplacement();
      
      if (controlTablesCheck.found.length > 0) {
        TestUtils.recordResult(
          'Control Table Misplacement',
          'FAIL',
          'Control tables found in tenant schema',
          { tables: controlTablesCheck.found },
          Date.now() - startTime
        );
      } else {
        TestUtils.recordResult(
          'Control Table Misplacement',
          'PASS',
          'No control tables in tenant schema'
        );
      }
      
      // Test 6: Verify tenant data
      TestLogger.step(6, 'Verifying default tenant data');
      const dataCheck = await this.verifyTenantData();
      
      if (!dataCheck.valid) {
        TestUtils.recordResult(
          'Tenant Data',
          'WARNING',
          'Some default data may be missing',
          { issues: dataCheck.issues }
        );
      } else {
        TestUtils.recordResult(
          'Tenant Data',
          'PASS',
          'Default tenant data present'
        );
      }
      
      // Test 7: Verify tenant registry entry
      TestLogger.step(7, 'Verifying tenant registry entry');
      const entryCheck = await this.verifyRegistryEntry();
      
      if (!entryCheck.valid) {
        TestUtils.recordResult(
          'Registry Entry',
          'FAIL',
          'Invalid tenant registry entry',
          { issues: entryCheck.issues },
          Date.now() - startTime
        );
      } else {
        TestUtils.recordResult(
          'Registry Entry',
          'PASS',
          `Registry entry valid (status: ${entryCheck.status})`
        );
      }
      
      await this.sequelize.close();
      
      return {
        success: true,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      if (this.sequelize) await this.sequelize.close();
      
      return TestUtils.recordResult(
        'Database Verification',
        'FAIL',
        `Error: ${error.message}`,
        { stack: error.stack },
        Date.now() - startTime
      );
    }
  }
  
  async verifyPublicTables() {
    const [tables] = await this.sequelize.query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );
    
    const tableNames = tables.map(t => t.table_name);
    const missing = TEST_CONFIG.requiredPublicTables.filter(
      t => !tableNames.includes(t)
    );
    
    return {
      valid: missing.length === 0,
      missing,
      found: tableNames
    };
  }
  
  async verifyTenantRegistry() {
    const [columns] = await this.sequelize.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'tenant_registry'`
    );
    
    const columnNames = columns.map(c => c.column_name);
    const missing = TEST_CONFIG.requiredRegistryColumns.filter(
      c => !columnNames.includes(c)
    );
    
    return {
      valid: missing.length === 0,
      missing,
      found: columnNames
    };
  }
  
  async verifyTenantSchema() {
    const [schemas] = await this.sequelize.query(
      `SELECT schema_name FROM information_schema.schemata 
       WHERE schema_name = :schema`,
      { replacements: { schema: this.schemaName } }
    );
    
    return {
      exists: schemas.length > 0
    };
  }
  
  async verifyTenantTables() {
    const [tables] = await this.sequelize.query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = :schema AND table_type = 'BASE TABLE'`,
      { replacements: { schema: this.schemaName } }
    );
    
    const tableNames = tables.map(t => t.table_name);
    const missing = TEST_CONFIG.requiredTenantTables.filter(
      t => !tableNames.includes(t)
    );
    
    return {
      valid: missing.length === 0,
      missing,
      found: tableNames
    };
  }
  
  async checkControlTableMisplacement() {
    const controlTables = ['businesses', 'users', 'tenant_registry', 'plans', 'subscriptions'];
    
    const [tables] = await this.sequelize.query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = :schema 
       AND table_name IN (:controlTables)`,
      { 
        replacements: { 
          schema: this.schemaName,
          controlTables
        } 
      }
    );
    
    return {
      found: tables.map(t => t.table_name)
    };
  }
  
  async verifyTenantData() {
    const issues = [];
    
    try {
      // Check if default outlet exists
      const [outlets] = await this.sequelize.query(
        `SELECT COUNT(*) as count FROM "${this.schemaName}".outlets`
      );
      
      if (outlets[0].count === 0) {
        issues.push('No outlets found');
      }
      
      // Check if default user exists
      const [users] = await this.sequelize.query(
        `SELECT COUNT(*) as count FROM "${this.schemaName}".users`
      );
      
      if (users[0].count === 0) {
        issues.push('No users found');
      }
      
    } catch (error) {
      issues.push(`Error checking tenant data: ${error.message}`);
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
  
  async verifyRegistryEntry() {
    const [rows] = await this.sequelize.query(
      `SELECT * FROM public.tenant_registry 
       WHERE business_id = :businessId`,
      { replacements: { businessId: TEST_STATE.businessId } }
    );
    
    if (rows.length === 0) {
      return {
        valid: false,
        issues: ['No registry entry found for business']
      };
    }
    
    const entry = rows[0];
    const issues = [];
    
    if (!entry.schema_name) issues.push('Missing schema_name');
    if (!entry.status) issues.push('Missing status');
    if (!entry.created_at) issues.push('Missing created_at');
    
    return {
      valid: issues.length === 0,
      issues,
      status: entry.status,
      entry
    };
  }
}

module.exports = DatabaseVerification;
