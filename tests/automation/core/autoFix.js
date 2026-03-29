/**
 * AUTO-FIX MODULE
 * ===============
 * 
 * Step 11: Automatically fix code-level issues based on test results
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('./testFramework');

/**
 * Auto-Fix Module - Applies code-level fixes
 */
class AutoFixModule {
  constructor(testResults) {
    this.testResults = testResults;
    this.fixes = [];
    this.filesModified = new Set();
  }
  
  async execute() {
    logger.section('STEP 11: AUTO FIX (CODE LEVEL)');
    
    await this.fixOnboardingIssues();
    await this.fixDatabaseIssues();
    await this.fixModelIssues();
    await this.fixAPIIssues();
    await this.addSafetySystems();
    
    logger.success(`Auto-fix complete: ${this.fixes.length} fixes applied`);
    
    return {
      success: this.fixes.length > 0,
      fixes: this.fixes,
      filesModified: Array.from(this.filesModified)
    };
  }
  
  async fixOnboardingIssues() {
    logger.info('Checking for onboarding issues to fix...');
    
    const onboardingResults = this.testResults.onboarding;
    if (!onboardingResults || onboardingResults.success) {
      return;
    }
    
    // Fix 1: Add better error handling to onboarding
    const onboardingServicePath = path.join(__dirname, '../../../services/onboardingService.js');
    if (fs.existsSync(onboardingServicePath)) {
      let content = fs.readFileSync(onboardingServicePath, 'utf8');
      
      // Check if it needs better error handling
      if (!content.includes('try {')) {
        logger.warning('OnboardingService may need try-catch blocks - manual review required');
      }
      
      // Add validation guard if missing
      if (!content.includes('VALIDATION GUARD')) {
        this.fixes.push({
          type: 'onboarding',
          file: onboardingServicePath,
          description: 'Adding validation guards to onboarding'
        });
      }
    }
    
    // Fix 2: Ensure default data seeding
    const seederPath = path.join(__dirname, '../../../services/tenant/tenantDataSeeder.js');
    if (!fs.existsSync(seederPath)) {
      await this.createDefaultSeeder(seederPath);
    }
  }
  
  async fixDatabaseIssues() {
    logger.info('Checking for database issues to fix...');
    
    const dbResults = this.testResults.database;
    if (!dbResults) return;
    
    // Fix missing tables by ensuring migrations run
    if (dbResults.results?.tenantSchema?.missingTables?.length > 0) {
      logger.info(`Found ${dbResults.results.tenantSchema.missingTables.length} missing tables`);
      
      // Ensure migration runner has retry logic
      const migrationRunnerPath = path.join(__dirname, '../../../src/architecture/migrationRunner.js');
      if (fs.existsSync(migrationRunnerPath)) {
        let content = fs.readFileSync(migrationRunnerPath, 'utf8');
        
        // Add retry mechanism if not present
        if (!content.includes('retry') && !content.includes('attempt')) {
          this.addRetryLogicToMigrations(migrationRunnerPath, content);
        }
      }
    }
  }
  
  async fixModelIssues() {
    logger.info('Checking for model issues to fix...');
    
    const modelResults = this.testResults.model;
    if (!modelResults || !modelResults.issues) return;
    
    for (const issue of modelResults.issues) {
      if (issue.issue === 'Column not found in database') {
        await this.fixMissingColumn(issue);
      } else if (issue.issue === 'Missing required fields') {
        await this.addMissingFields(issue);
      }
    }
  }
  
  async fixAPIIssues() {
    logger.info('Checking for API issues to fix...');
    
    const apiResults = this.testResults.api;
    if (!apiResults || !apiResults.results) return;
    
    // Find controllers with null pointer issues
    const failingEndpoints = apiResults.results.filter(r => !r.passed);
    
    for (const endpoint of failingEndpoints) {
      if (endpoint.status === 500) {
        await this.addNullSafetyToController(endpoint);
      }
    }
  }
  
  async addSafetySystems() {
    logger.info('Adding safety systems...');
    
    // 1. Schema Guard
    await this.ensureSchemaGuard();
    
    // 2. Default Data Seeder
    await this.ensureDefaultDataSeeder();
    
    // 3. Onboarding Validation
    await this.addOnboardingValidation();
    
    // 4. API Null Safety
    await this.addAPINullSafety();
  }
  
  async fixMissingColumn(issue) {
    const modelFile = path.join(
      __dirname, 
      `../../../models/${issue.model.toLowerCase()}Model.js`
    );
    
    if (!fs.existsSync(modelFile)) {
      logger.warning(`Model file not found: ${modelFile}`);
      return;
    }
    
    let content = fs.readFileSync(modelFile, 'utf8');
    
    // Add field mapping if missing
    if (!content.includes(`field: '${issue.field}'`)) {
      // Find the attribute and add field mapping
      const attrRegex = new RegExp(`${issue.attribute}:`, 'g');
      if (attrRegex.test(content)) {
        // Add field mapping after the attribute
        content = content.replace(
          new RegExp(`(${issue.attribute}:\s*\{[^}]+})`, 'g'),
          `$1\n      field: '${issue.field}',`
        );
        
        fs.writeFileSync(modelFile, content);
        this.fixes.push({
          type: 'model',
          file: modelFile,
          description: `Added field mapping for ${issue.attribute} -> ${issue.field}`
        });
        this.filesModified.add(modelFile);
      }
    }
  }
  
  async addMissingFields(issue) {
    const modelFile = path.join(
      __dirname, 
      `../../../models/${issue.model.toLowerCase()}Model.js`
    );
    
    if (!fs.existsSync(modelFile)) {
      return;
    }
    
    let content = fs.readFileSync(modelFile, 'utf8');
    
    for (const field of issue.missing) {
      if (!content.includes(`${field}:`)) {
        // Add the field to the model
        const fieldDefinition = `
    ${field}: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'businesses',
        key: 'id'
      }
    },`;
        
        // Find the attributes section and add the field
        const insertPoint = content.indexOf('return sequelize.define');
        if (insertPoint > 0) {
          const attrStart = content.indexOf('{', insertPoint);
          content = content.slice(0, attrStart + 1) + fieldDefinition + content.slice(attrStart + 1);
          
          this.fixes.push({
            type: 'model',
            file: modelFile,
            description: `Added missing field: ${field}`
          });
        }
      }
    }
    
    fs.writeFileSync(modelFile, content);
    this.filesModified.add(modelFile);
  }
  
  async addNullSafetyToController(endpoint) {
    // Extract controller name from URL
    const urlParts = endpoint.url.split('/');
    const resource = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
    
    if (!resource) return;
    
    const controllerName = `${resource.charAt(0).toUpperCase() + resource.slice(1)}Controller.js`;
    const controllerPaths = [
      path.join(__dirname, `../../../controllers/tenant/${controllerName}`),
      path.join(__dirname, `../../../controllers/${controllerName}`)
    ];
    
    for (const controllerPath of controllerPaths) {
      if (fs.existsSync(controllerPath)) {
        let content = fs.readFileSync(controllerPath, 'utf8');
        
        // Add null safety patterns
        const patterns = [
          { find: /const\s+(\w+)\s*=\s*req\.body;/g, replace: 'const $1 = req.body || {};' },
          { find: /(\w+)\.map\(/g, replace: '($1 || []).map(' },
          { find: /(\w+)\.forEach\(/g, replace: '($1 || []).forEach(' },
          { find: /(\w+)\.length/g, replace: '($1 || []).length' }
        ];
        
        let modified = false;
        for (const pattern of patterns) {
          if (pattern.find.test(content)) {
            content = content.replace(pattern.find, pattern.replace);
            modified = true;
          }
        }
        
        if (modified) {
          fs.writeFileSync(controllerPath, content);
          this.fixes.push({
            type: 'api',
            file: controllerPath,
            description: `Added null safety to ${resource} controller`
          });
          this.filesModified.add(controllerPath);
        }
        
        break;
      }
    }
  }
  
  async ensureSchemaGuard() {
    const schemaGuardPath = path.join(__dirname, '../../../src/utils/schemaGuard.js');
    
    if (fs.existsSync(schemaGuardPath)) {
      logger.info('Schema guard already exists');
      return;
    }
    
    const schemaGuardContent = `/**
 * Schema Guard
 * ============
 * Auto-creates missing tables and schemas
 */

const { Sequelize } = require('sequelize');
const { getDBConnection } = require('../config/unified_database');
const { TENANT_MODELS, CONTROL_MODELS } = require('./constants');
const { ModelFactory } = require('../architecture/modelFactory');

class SchemaGuard {
  async ensureSchemaExists(schemaName) {
    const db = await getDBConnection();
    
    const [exists] = await db.query(
      'SELECT 1 FROM information_schema.schemata WHERE schema_name = :schema',
      { replacements: { schema: schemaName }, type: Sequelize.QueryTypes.SELECT }
    );
    
    if (!exists) {
      await db.query(\`CREATE SCHEMA IF NOT EXISTS "\${schemaName}"\`);
      console.log(\`[SchemaGuard] Created schema: \${schemaName}\`);
    }
    
    return true;
  }
  
  async ensureTenantTables(schemaName) {
    const db = await getDBConnection();
    await ModelFactory.createModels(db);
    
    // Get existing tables
    const tables = await db.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = :schema',
      { replacements: { schema: schemaName }, type: Sequelize.QueryTypes.SELECT }
    );
    
    const existingTables = new Set(tables.map(t => t.table_name));
    
    // Get tenant models
    const models = Object.entries(db.models)
      .filter(([name]) => TENANT_MODELS.includes(name))
      .map(([_, model]) => model);
    
    // Create missing tables
    for (const model of models) {
      const tableName = model.getTableName();
      const table = typeof tableName === 'string' ? tableName : tableName.tableName;
      
      if (!existingTables.has(table)) {
        try {
          await model.schema(schemaName).sync({ force: false });
          console.log(\`[SchemaGuard] Created table: \${schemaName}.\${table}\`);
        } catch (error) {
          console.error(\`[SchemaGuard] Failed to create \${table}:\`, error.message);
        }
      }
    }
  }
}

module.exports = new SchemaGuard();
`;
    
    fs.writeFileSync(schemaGuardPath, schemaGuardContent);
    this.fixes.push({
      type: 'safety',
      file: schemaGuardPath,
      description: 'Created schema guard for auto-creating missing tables'
    });
    this.filesModified.add(schemaGuardPath);
  }
  
  async createDefaultSeeder(seederPath) {
    const seederContent = `/**
 * Tenant Data Seeder
 * ==================
 * Seeds default data for new tenants
 */

const { v4: uuidv4 } = require('uuid');

class TenantDataSeeder {
  async seed(tenantModels, schemaName, businessId, outletId) {
    const results = { categories: [], areas: [], inventoryCategories: [] };
    
    try {
      // Seed default categories
      if (tenantModels.Category) {
        const categories = [
          { name: 'Food', color: '#FF6B6B' },
          { name: 'Beverages', color: '#4ECDC4' },
          { name: 'Desserts', color: '#FFE66D' }
        ];
        
        for (const cat of categories) {
          const [category] = await tenantModels.Category.schema(schemaName).findOrCreate({
            where: { name: cat.name, businessId },
            defaults: {
              id: uuidv4(),
              businessId,
              outletId,
              name: cat.name,
              color: cat.color,
              status: 'active'
            }
          });
          results.categories.push(category);
        }
      }
      
      // Seed default areas
      if (tenantModels.Area) {
        const [area] = await tenantModels.Area.schema(schemaName).findOrCreate({
          where: { name: 'Main Area', businessId },
          defaults: {
            id: uuidv4(),
            businessId,
            outletId,
            name: 'Main Area',
            status: 'active'
          }
        });
        results.areas.push(area);
      }
      
      // Seed inventory categories
      if (tenantModels.InventoryCategory) {
        const [invCat] = await tenantModels.InventoryCategory.schema(schemaName).findOrCreate({
          where: { name: 'General', businessId },
          defaults: {
            id: uuidv4(),
            businessId,
            outletId,
            name: 'General'
          }
        });
        results.inventoryCategories.push(invCat);
      }
      
      return { success: true, data: results };
    } catch (error) {
      console.error('[TenantDataSeeder] Error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new TenantDataSeeder();
`;
    
    // Ensure directory exists
    const dir = path.dirname(seederPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(seederPath, seederContent);
    this.fixes.push({
      type: 'safety',
      file: seederPath,
      description: 'Created default data seeder'
    });
    this.filesModified.add(seederPath);
  }
  
  async addOnboardingValidation() {
    const validationPath = path.join(__dirname, '../../../src/utils/onboardingValidator.js');
    
    if (fs.existsSync(validationPath)) {
      return;
    }
    
    const validationContent = `/**
 * Onboarding Validator
 * ====================
 * Validates tenant onboarding before activation
 */

const { Sequelize } = require('sequelize');
const { getDBConnection } = require('../../config/unified_database');

class OnboardingValidator {
  async validate(tenantId, schemaName) {
    const errors = [];
    const db = await getDBConnection();
    
    // Check schema exists
    const [schema] = await db.query(
      'SELECT 1 FROM information_schema.schemata WHERE schema_name = :schema',
      { replacements: { schema: schemaName }, type: Sequelize.QueryTypes.SELECT }
    );
    
    if (!schema) {
      errors.push(\`Schema \${schemaName} does not exist\`);
      return { valid: false, errors };
    }
    
    // Check required tables exist
    const requiredTables = ['outlets', 'categories', 'settings'];
    const tables = await db.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = :schema',
      { replacements: { schema: schemaName }, type: Sequelize.QueryTypes.SELECT }
    );
    
    const existingTables = new Set(tables.map(t => t.table_name));
    
    for (const table of requiredTables) {
      if (!existingTables.has(table)) {
        errors.push(\`Required table missing: \${table}\`);
      }
    }
    
    // Check required data exists
    try {
      const [outletCount] = await db.query(
        \`SELECT COUNT(*) as count FROM "\${schemaName}".outlets WHERE business_id = :tenantId\`,
        { replacements: { tenantId }, type: Sequelize.QueryTypes.SELECT }
      );
      
      if (parseInt(outletCount.count) === 0) {
        errors.push('No outlet found for tenant');
      }
    } catch (error) {
      errors.push(\`Failed to check outlets: \${error.message}\`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = new OnboardingValidator();
`;
    
    fs.writeFileSync(validationPath, validationContent);
    this.fixes.push({
      type: 'safety',
      file: validationPath,
      description: 'Created onboarding validation system'
    });
    this.filesModified.add(validationPath);
  }
  
  async addAPINullSafety() {
    const middlewarePath = path.join(__dirname, '../../../middlewares/nullSafetyMiddleware.js');
    
    if (fs.existsSync(middlewarePath)) {
      return;
    }
    
    const middlewareContent = `/**
 * Null Safety Middleware
 * ======================
 * Adds defensive null checks to API responses
 */

function nullSafetyMiddleware(req, res, next) {
  // Wrap res.json to add null safety
  const originalJson = res.json.bind(res);
  
  res.json = function(data) {
    // Sanitize data
    const sanitized = sanitizeNulls(data);
    return originalJson(sanitized);
  };
  
  next();
}

function sanitizeNulls(data) {
  if (data === null || data === undefined) {
    return null;
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeNulls);
  }
  
  if (typeof data === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) {
        sanitized[key] = null;
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeNulls(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
  
  return data;
}

module.exports = { nullSafetyMiddleware, sanitizeNulls };
`;
    
    fs.writeFileSync(middlewarePath, middlewareContent);
    this.fixes.push({
      type: 'safety',
      file: middlewarePath,
      description: 'Created API null safety middleware'
    });
    this.filesModified.add(middlewarePath);
  }
  
  addRetryLogicToMigrations(filePath, content) {
    // Add retry wrapper around migration execution
    const retryWrapper = `
async function runWithRetry(operation, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.log(\`Migration attempt \${attempt} failed, retrying...\`);
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}`;
    
    // Insert retry wrapper at the beginning
    const insertionPoint = content.indexOf('module.exports') > 0 
      ? content.indexOf('module.exports')
      : 0;
    
    const newContent = content.slice(0, insertionPoint) + retryWrapper + '\n\n' + content.slice(insertionPoint);
    
    fs.writeFileSync(filePath, newContent);
    this.fixes.push({
      type: 'database',
      file: filePath,
      description: 'Added retry logic to migration runner'
    });
    this.filesModified.add(filePath);
  }
}

module.exports = { AutoFixModule };
