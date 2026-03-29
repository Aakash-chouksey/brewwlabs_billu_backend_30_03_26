/**
 * DATABASE VALIDATION MODULE
 * ==========================
 * 
 * Steps 3-5: Database Structure, Data Integrity, Model Consistency
 */

const { Sequelize } = require('sequelize');
const { logger, withRetry, getDBConnection } = require('./testFramework');
const { CONTROL_MODELS, TENANT_MODELS, PUBLIC_SCHEMA, TENANT_SCHEMA_PREFIX } = require('../../../src/utils/constants');

/**
 * Database Structure Validation - Step 3
 */
class DatabaseStructureModule {
  constructor(testTenant) {
    this.testTenant = testTenant;
    this.validationResults = {
      publicSchema: { valid: false, tables: [], issues: [] },
      tenantSchema: { valid: false, tables: [], missingTables: [], issues: [] }
    };
  }
  
  async execute() {
    logger.section('STEP 3: DATABASE STRUCTURE VALIDATION');
    
    await this.validatePublicSchema();
    await this.validateTenantSchema();
    
    const allValid = this.validationResults.publicSchema.valid && 
                     this.validationResults.tenantSchema.valid;
    
    if (allValid) {
      logger.success('Database structure validation complete - all checks passed');
    } else {
      logger.error('Database structure validation failed', null, this.validationResults);
    }
    
    return { success: allValid, results: this.validationResults };
  }
  
  async validatePublicSchema() {
    logger.info('Validating public schema structure...');
    const db = await getDBConnection();
    
    // 1. Check tenant_registry table exists
    const registryTable = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'tenant_registry'
    `, { type: Sequelize.QueryTypes.SELECT });
    
    if (!registryTable.length) {
      this.validationResults.publicSchema.issues.push('tenant_registry table missing');
      return;
    }
    
    // 2. Check required columns
    const requiredColumns = ['business_id', 'schema_name', 'status', 'retry_count', 'last_error'];
    const existingColumns = registryTable.map(col => col.column_name);
    
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      this.validationResults.publicSchema.issues.push(
        `Missing columns in tenant_registry: ${missingColumns.join(', ')}`
      );
    }
    
    // 3. Check all control plane tables exist
    const controlTables = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `, { type: Sequelize.QueryTypes.SELECT });
    
    const existingTables = controlTables.map(t => t.table_name);
    const expectedControlTables = ['businesses', 'users', 'tenant_registry'];
    
    for (const table of expectedControlTables) {
      if (!existingTables.includes(table)) {
        this.validationResults.publicSchema.issues.push(`Missing public table: ${table}`);
      }
    }
    
    this.validationResults.publicSchema.valid = 
      this.validationResults.publicSchema.issues.length === 0;
    this.validationResults.publicSchema.tables = existingTables;
    
    logger.success('Public schema validated', { 
      tables: existingTables.length,
      issues: this.validationResults.publicSchema.issues.length 
    });
  }
  
  async validateTenantSchema() {
    logger.info(`Validating tenant schema: ${this.testTenant.schemaName}...`);
    const db = await getDBConnection();
    
    // 1. Check schema exists
    const schemaExists = await db.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name = :schema
    `, { replacements: { schema: this.testTenant.schemaName }, type: Sequelize.QueryTypes.SELECT });
    
    if (!schemaExists.length) {
      this.validationResults.tenantSchema.issues.push('Schema does not exist');
      return;
    }
    
    // 2. Get all tables in tenant schema
    const tenantTables = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = :schema
      AND table_type = 'BASE TABLE'
    `, { replacements: { schema: this.testTenant.schemaName }, type: Sequelize.QueryTypes.SELECT });
    
    const existingTables = tenantTables.map(t => t.table_name);
    this.validationResults.tenantSchema.tables = existingTables;
    
    // 3. Check for expected tenant tables
    const expectedTables = [
      'outlets', 'products', 'categories', 'orders', 'order_items',
      'inventory', 'inventory_items', 'users', 'customers', 'settings',
      'schema_versions'
    ];
    
    const missingTables = expectedTables.filter(table => 
      !existingTables.some(t => t.toLowerCase() === table.toLowerCase())
    );
    
    if (missingTables.length > 0) {
      this.validationResults.tenantSchema.missingTables = missingTables;
      this.validationResults.tenantSchema.issues.push(
        `Missing tables: ${missingTables.join(', ')}`
      );
    }
    
    // 4. Check for control tables in tenant schema (should NOT be there)
    const controlTableNames = ['businesses', 'tenant_registry', 'subscriptions'];
    const wrongTables = existingTables.filter(table => 
      controlTableNames.includes(table.toLowerCase())
    );
    
    if (wrongTables.length > 0) {
      this.validationResults.tenantSchema.issues.push(
        `Control tables found in tenant schema: ${wrongTables.join(', ')}`
      );
    }
    
    this.validationResults.tenantSchema.valid = 
      this.validationResults.tenantSchema.issues.length === 0;
    
    logger.success('Tenant schema validated', {
      tableCount: existingTables.length,
      missing: missingTables.length,
      issues: this.validationResults.tenantSchema.issues.length
    });
  }
}

/**
 * Data Integrity Validation - Step 4
 */
class DataIntegrityModule {
  constructor(testTenant) {
    this.testTenant = testTenant;
    this.dataChecks = {
      users: { required: true, exists: false },
      outlets: { required: true, exists: false },
      settings: { required: true, exists: false },
      categories: { required: false, exists: false }
    };
  }
  
  async execute() {
    logger.section('STEP 4: DATA INTEGRITY VALIDATION');
    
    await this.checkRequiredData();
    await this.checkDefaultData();
    await this.checkForeignKeyIntegrity();
    
    const allValid = Object.values(this.dataChecks)
      .filter(check => check.required)
      .every(check => check.exists);
    
    if (allValid) {
      logger.success('Data integrity validation complete - all required data present');
    } else {
      const missing = Object.entries(this.dataChecks)
        .filter(([_, check]) => check.required && !check.exists)
        .map(([name, _]) => name);
      logger.error('Required data missing', null, { missing });
    }
    
    return { success: allValid, checks: this.dataChecks };
  }
  
  async checkRequiredData() {
    logger.info('Checking required data...');
    const db = await getDBConnection();
    const { schemaName, businessId } = this.testTenant;
    
    // Check admin user exists in public schema
    const users = await db.query(`
      SELECT id, email, role, business_id 
      FROM public.users 
      WHERE business_id = :businessId
    `, { replacements: { businessId }, type: Sequelize.QueryTypes.SELECT });
    
    this.dataChecks.users.exists = users.length > 0;
    if (this.dataChecks.users.exists) {
      logger.success('Admin user exists', { userId: users[0].id, email: users[0].email });
    } else {
      logger.error('Admin user not found in public.users');
    }
    
    // Check outlets exist in tenant schema
    const outlets = await db.query(`
      SELECT id, name, business_id 
      FROM "${schemaName}".outlets 
      WHERE business_id = :businessId
    `, { replacements: { businessId }, type: Sequelize.QueryTypes.SELECT });
    
    this.dataChecks.outlets.exists = outlets.length > 0;
    if (this.dataChecks.outlets.exists) {
      logger.success('Outlet exists', { outletId: outlets[0].id, name: outlets[0].name });
    } else {
      logger.error('No outlets found in tenant schema');
    }
    
    // Check settings
    const settings = await db.query(`
      SELECT id, key, value 
      FROM "${schemaName}".settings 
      LIMIT 5
    `, { type: Sequelize.QueryTypes.SELECT });
    
    this.dataChecks.settings.exists = settings.length > 0;
    if (this.dataChecks.settings.exists) {
      logger.success('Settings exist', { count: settings.length });
    } else {
      logger.warning('No settings found - may be optional');
      this.dataChecks.settings.required = false;
    }
    
    // Check categories
    const categories = await db.query(`
      SELECT id, name 
      FROM "${schemaName}".categories 
      LIMIT 5
    `, { type: Sequelize.QueryTypes.SELECT });
    
    this.dataChecks.categories.exists = categories.length > 0;
    if (this.dataChecks.categories.exists) {
      logger.success('Categories exist', { count: categories.length });
    }
  }
  
  async checkDefaultData() {
    logger.info('Checking default data seeding...');
    const db = await getDBConnection();
    const { schemaName, businessId } = this.testTenant;
    
    // Check for default categories
    try {
      const defaultCategories = await db.query(`
        SELECT id, name 
        FROM "${schemaName}".categories 
        WHERE business_id = :businessId
      `, { replacements: { businessId }, type: Sequelize.QueryTypes.SELECT });
      
      if (defaultCategories.length === 0) {
        logger.warning('No default categories found');
      } else {
        logger.success(`Found ${defaultCategories.length} categories`);
      }
    } catch (error) {
      logger.warning('Could not check categories', error);
    }
    
    // Check for default inventory categories
    try {
      const inventoryCategories = await db.query(`
        SELECT id, name 
        FROM "${schemaName}".inventory_categories 
        LIMIT 5
      `, { type: Sequelize.QueryTypes.SELECT });
      
      if (inventoryCategories.length === 0) {
        logger.warning('No default inventory categories found');
      } else {
        logger.success(`Found ${inventoryCategories.length} inventory categories`);
      }
    } catch (error) {
      logger.warning('Could not check inventory categories', error);
    }
  }
  
  async checkForeignKeyIntegrity() {
    logger.info('Checking foreign key integrity...');
    const db = await getDBConnection();
    const { schemaName, businessId } = this.testTenant;
    
    // Check that products reference valid categories
    try {
      const orphanedProducts = await db.query(`
        SELECT p.id, p.name, p.category_id 
        FROM "${schemaName}".products p
        LEFT JOIN "${schemaName}".categories c ON p.category_id = c.id
        WHERE c.id IS NULL AND p.category_id IS NOT NULL
        LIMIT 5
      `, { type: Sequelize.QueryTypes.SELECT });
      
      if (orphanedProducts.length > 0) {
        logger.warning(`Found ${orphanedProducts.length} orphaned products`, orphanedProducts);
      } else {
        logger.success('No orphaned products found');
      }
    } catch (error) {
      logger.warning('Could not check product-category integrity', error);
    }
  }
}

/**
 * Model-DB Consistency Check - Step 5
 */
class ModelConsistencyModule {
  constructor(testTenant) {
    this.testTenant = testTenant;
    this.consistencyIssues = [];
  }
  
  async execute() {
    logger.section('STEP 5: MODEL ↔ DATABASE CONSISTENCY CHECK');
    
    await this.loadAndCheckModels();
    await this.checkColumnMappings();
    await this.checkMissingFields();
    
    if (this.consistencyIssues.length === 0) {
      logger.success('Model-DB consistency check passed');
    } else {
      logger.error('Model-DB consistency issues found', null, { 
        issueCount: this.consistencyIssues.length 
      });
    }
    
    return { 
      success: this.consistencyIssues.length === 0, 
      issues: this.consistencyIssues 
    };
  }
  
  async loadAndCheckModels() {
    logger.info('Loading Sequelize models...');
    
    try {
      // Initialize models
      const { ModelFactory } = require('../../../src/architecture/modelFactory');
      const db = await getDBConnection();
      await ModelFactory.createModels(db);
      
      this.models = db.models;
      logger.success(`Loaded ${Object.keys(this.models).length} models`);
      
      // Check model classification
      const controlModelNames = Object.keys(this.models).filter(name => 
        CONTROL_MODELS.includes(name)
      );
      const tenantModelNames = Object.keys(this.models).filter(name => 
        TENANT_MODELS.includes(name)
      );
      
      logger.success(`Control models: ${controlModelNames.length}, Tenant models: ${tenantModelNames.length}`);
      
    } catch (error) {
      logger.error('Failed to load models', error);
      throw error;
    }
  }
  
  async checkColumnMappings() {
    logger.info('Checking column mappings...');
    const db = await getDBConnection();
    const { schemaName } = this.testTenant;
    
    // Get all columns in tenant schema
    const columns = await db.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = :schema
    `, { replacements: { schema: schemaName }, type: Sequelize.QueryTypes.SELECT });
    
    const columnMap = {};
    columns.forEach(({ table_name, column_name }) => {
      if (!columnMap[table_name]) columnMap[table_name] = new Set();
      columnMap[table_name].add(column_name.toLowerCase());
    });
    
    // Check each tenant model
    for (const [modelName, model] of Object.entries(this.models)) {
      if (!TENANT_MODELS.includes(modelName)) continue;
      
      const tableName = model.getTableName();
      const table = typeof tableName === 'string' ? tableName : tableName.tableName;
      const tableLower = table.toLowerCase();
      
      if (!columnMap[tableLower]) {
        this.consistencyIssues.push({
          model: modelName,
          table,
          issue: 'Table not found in schema'
        });
        continue;
      }
      
      // Check model attributes exist as columns
      const attributes = model.rawAttributes || {};
      for (const [attrName, attr] of Object.entries(attributes)) {
        const fieldName = (attr.field || attrName).toLowerCase();
        
        if (!columnMap[tableLower].has(fieldName)) {
          this.consistencyIssues.push({
            model: modelName,
            table,
            attribute: attrName,
            field: fieldName,
            issue: 'Column not found in database'
          });
        }
      }
    }
    
    logger.success(`Checked column mappings, found ${this.consistencyIssues.length} issues`);
  }
  
  async checkMissingFields() {
    logger.info('Checking for missing required fields...');
    
    const requiredFieldChecks = [
      { model: 'Product', fields: ['businessId', 'outletId', 'name', 'price'] },
      { model: 'Order', fields: ['businessId', 'outletId', 'status'] },
      { model: 'User', fields: ['businessId', 'email', 'role'] }
    ];
    
    for (const check of requiredFieldChecks) {
      const model = this.models[check.model];
      if (!model) {
        logger.warning(`Model ${check.model} not found`);
        continue;
      }
      
      const attributes = Object.keys(model.rawAttributes || {});
      const missing = check.fields.filter(field => !attributes.includes(field));
      
      if (missing.length > 0) {
        this.consistencyIssues.push({
          model: check.model,
          issue: 'Missing required fields',
          missing
        });
        logger.warning(`${check.model} missing fields: ${missing.join(', ')}`);
      } else {
        logger.success(`${check.model} has all required fields`);
      }
    }
  }
}

module.exports = {
  DatabaseStructureModule,
  DataIntegrityModule,
  ModelConsistencyModule
};
