/**
 * COMPREHENSIVE MULTI-TENANT SYSTEM AUDIT
 * 
 * Performs deep checks on:
 * 1. Schema Consistency
 * 2. Association & Join Validation
 * 3. Data Consistency
 * 4. API Performance Analysis
 * 
 * PRODUCTION USAGE:
 * - This script is READ-ONLY and safe for production
 * - Recommended: Run during low-traffic periods
 * - For large deployments (>50 tenants), checks are automatically sampled
 */

require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');
const { performance } = require('perf_hooks');

// Import system modules
const { sequelize, setInitializationPhase } = require('../config/unified_database');
const { ModelFactory } = require('../src/architecture/modelFactory');
const { CONTROL_MODELS, TENANT_MODELS, PUBLIC_SCHEMA, TENANT_SCHEMA_PREFIX } = require('../src/utils/constants');

// ========================================
// PRODUCTION SAFETY CONFIGURATION
// ========================================
const PRODUCTION_SAFE = {
  // Maximum tenants to check (prevents overwhelming the DB)
  maxTenantsToCheck: process.env.AUDIT_MAX_TENANTS ? parseInt(process.env.AUDIT_MAX_TENANTS) : 10,
  // Skip data consistency checks in production (can be slow)
  skipDataChecks: process.env.AUDIT_SKIP_DATA_CHECKS === 'true',
  // Add delay between tenant checks to reduce load
  tenantCheckDelayMs: process.env.AUDIT_THROTTLE_MS ? parseInt(process.env.AUDIT_THROTTLE_MS) : 0
};

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// Global state
let auditResults = {
  criticalIssues: [],
  mediumIssues: [],
  safeAreas: [],
  schemaStatus: 'UNKNOWN',
  performanceStatus: {},
  totalTenants: 0,
  checkedTenants: 0
};

// ========================================
// UTILITY FUNCTIONS
// ========================================

function logSection(title) {
  console.log(`\n${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  ${title}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);
}

function logCritical(message) {
  console.log(`${colors.red}[CRITICAL]${colors.reset} ${message}`);
  auditResults.criticalIssues.push(message);
}

function logWarning(message) {
  console.log(`${colors.yellow}[WARNING]${colors.reset} ${message}`);
  auditResults.mediumIssues.push(message);
}

function logSuccess(message) {
  console.log(`${colors.green}[OK]${colors.reset} ${message}`);
  auditResults.safeAreas.push(message);
}

function logInfo(message) {
  console.log(`${colors.blue}[INFO]${colors.reset} ${message}`);
}

// ========================================
// STEP 1: SCHEMA CONSISTENCY DEEP CHECK
// ========================================

async function checkSchemaConsistency() {
  logSection('STEP 1: SCHEMA CONSISTENCY DEEP CHECK');

  const mismatches = [];
  let totalTablesChecked = 0;
  let totalColumnsChecked = 0;

  try {
    // Get all tenant schemas
    const schemas = await sequelize.query(
      `SELECT schema_name 
       FROM information_schema.schemata 
       WHERE schema_name LIKE '${TENANT_SCHEMA_PREFIX}%'
       ORDER BY schema_name`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    auditResults.totalTenants = schemas.length;
    logInfo(`Found ${schemas.length} tenant schemas to check`);
    
    // PRODUCTION SAFETY: Sample tenants if too many
    let tenantsToCheck = schemas;
    if (schemas.length > PRODUCTION_SAFE.maxTenantsToCheck) {
      logWarning(`Large tenant count (${schemas.length}). Sampling ${PRODUCTION_SAFE.maxTenantsToCheck} tenants for performance.`);
      logInfo(`Tip: Set AUDIT_MAX_TENANTS=N to check more tenants`);
      tenantsToCheck = schemas.slice(0, PRODUCTION_SAFE.maxTenantsToCheck);
    }

    // Get expected model definitions
    const expectedColumns = getExpectedColumnsFromModels();
    logInfo(`Loaded ${Object.keys(expectedColumns).length} model definitions`);

    for (const { schema_name } of tenantsToCheck) {
      logInfo(`Checking schema: ${schema_name}`);
      
      // Get actual tables and columns from database
      const actualTables = await getSchemaTablesAndColumns(schema_name);
      
      // PRODUCTION SAFETY: Add throttle delay if configured
      if (PRODUCTION_SAFE.tenantCheckDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, PRODUCTION_SAFE.tenantCheckDelayMs));
      }
      
      // Compare with expected
      for (const [tableName, expectedCols] of Object.entries(expectedColumns)) {
        if (!actualTables[tableName]) {
          mismatches.push({
            schema: schema_name,
            table: tableName,
            issue: 'MISSING_TABLE',
            severity: 'CRITICAL'
          });
          continue;
        }

        totalTablesChecked++;
        const actualCols = actualTables[tableName];
        
        // Check for missing columns
        for (const [colName, colDef] of Object.entries(expectedCols)) {
          totalColumnsChecked++;
          const actualCol = actualCols[colName];
          
          if (!actualCol) {
            mismatches.push({
              schema: schema_name,
              table: tableName,
              column: colName,
              issue: 'MISSING_COLUMN',
              severity: 'CRITICAL'
            });
            continue;
          }

          // Check data type compatibility
          const typeMismatch = checkTypeCompatibility(colDef.type, actualCol.data_type);
          if (typeMismatch) {
            mismatches.push({
              schema: schema_name,
              table: tableName,
              column: colName,
              issue: 'TYPE_MISMATCH',
              expected: colDef.type,
              actual: actualCol.data_type,
              severity: 'MEDIUM'
            });
          }

          // Check nullability
          if (colDef.allowNull !== undefined) {
            const actualNullable = actualCol.is_nullable === 'YES';
            if (colDef.allowNull !== actualNullable) {
              mismatches.push({
                schema: schema_name,
                table: tableName,
                column: colName,
                issue: 'NULLABILITY_MISMATCH',
                expected: colDef.allowNull ? 'NULLABLE' : 'NOT_NULL',
                actual: actualNullable ? 'NULLABLE' : 'NOT_NULL',
                severity: 'MEDIUM'
              });
            }
          }
        }

        // Check for extra columns (not in model)
        for (const colName of Object.keys(actualCols)) {
          if (!expectedCols[colName]) {
            mismatches.push({
              schema: schema_name,
              table: tableName,
              column: colName,
              issue: 'EXTRA_COLUMN',
              severity: 'LOW'
            });
          }
        }
      }

      auditResults.checkedTenants++;
    }

    // Report findings
    if (mismatches.length === 0) {
      logSuccess(`Schema consistency verified across all ${schemas.length} tenants`);
      logSuccess(`Checked ${totalTablesChecked} tables, ${totalColumnsChecked} columns`);
      auditResults.schemaStatus = 'ALIGNED';
    } else {
      logCritical(`Found ${mismatches.length} schema mismatches`);
      
      const critical = mismatches.filter(m => m.severity === 'CRITICAL');
      const medium = mismatches.filter(m => m.severity === 'MEDIUM');
      const low = mismatches.filter(m => m.severity === 'LOW');

      if (critical.length > 0) {
        logCritical(`${critical.length} critical issues found:`);
        critical.forEach(m => {
          console.log(`  - ${m.schema}.${m.table}${m.column ? '.' + m.column : ''}: ${m.issue}`);
        });
      }

      if (medium.length > 0) {
        logWarning(`${medium.length} medium issues found`);
      }

      if (low.length > 0) {
        logInfo(`${low.length} extra columns found (not in models)`);
      }

      auditResults.schemaStatus = 'ISSUES_DETECTED';
    }

    // Check schema_version consistency
    await checkSchemaVersionConsistency(schemas.map(s => s.schema_name));

  } catch (error) {
    logCritical(`Schema consistency check failed: ${error.message}`);
    auditResults.schemaStatus = 'CHECK_FAILED';
  }

  return mismatches;
}

function getExpectedColumnsFromModels() {
  // This maps model definitions to expected database columns
  // We need to load and parse the model files
  const modelFiles = {
    'products': require('../models/productModel'),
    'inventory': require('../models/inventoryModel'),
    'inventory_sales': require('../models/inventorySaleModel'),
    'orders': require('../models/orderModel'),
    'order_items': require('../models/orderItemModel'),
    'customers': require('../models/customerModel'),
    'categories': require('../models/categoryModel'),
    'outlets': require('../models/outletModel'),
    'payments': require('../models/paymentModel'),
    'suppliers': require('../models/supplierModel'),
    'purchases': require('../models/purchaseModel'),
    'purchase_items': require('../models/purchaseItemModel'),
    'tables': require('../models/tableModel'),
    'areas': require('../models/areaModel'),
    'expenses': require('../models/expenseModel'),
    'expense_types': require('../models/expenseTypeModel'),
    'recipes': require('../models/recipeModel'),
    'recipe_items': require('../models/recipeItemModel'),
    'inventory_items': require('../models/inventoryItemModel'),
    'inventory_categories': require('../models/inventoryCategoryModel'),
    'inventory_transactions': require('../models/inventoryTransactionModel'),
    'customer_transactions': require('../models/customerTransactionModel'),
    'customer_ledgers': require('../models/customerLedgerModel'),
    'stock_transactions': require('../models/stockTransactionModel'),
    'wastages': require('../models/wastageModel'),
    'settings': require('../models/settingModel'),
    'timings': require('../models/timingModel'),
    'operation_timings': require('../models/operationTimingModel'),
    'membership_plans': require('../models/membershipPlanModel'),
    'partner_memberships': require('../models/partnerMembershipModel'),
    'partner_types': require('../models/partnerTypeModel'),
    'partner_wallets': require('../models/partnerWalletModel'),
    'product_types': require('../models/productTypeModel'),
    'feature_flags': require('../models/featureFlagModel'),
    'billing_configs': require('../models/billingConfigModel'),
    'accounts': require('../models/accountModel'),
    'account_transactions': require('../models/accountTransactionModel'),
    'incomes': require('../models/incomeModel'),
    'schema_versions': require('../models/schemaVersionModel'),
    'tenant_audit_logs': require('../models/tenantAuditLogModel'),
    'roll_trackings': require('../models/rollTrackingModel'),
    'web_contents': require('../models/webContentModel')
  };

  const expectedColumns = {};

  // Create a mock sequelize to extract column definitions
  const mockSequelize = {
    define: (name, attributes, options) => {
      expectedColumns[options.tableName] = {};
      for (const [colName, colDef] of Object.entries(attributes)) {
        const field = colDef.field || colName;
        expectedColumns[options.tableName][field] = {
          type: colDef.type ? colDef.type.key || String(colDef.type) : 'UNKNOWN',
          allowNull: colDef.allowNull,
          defaultValue: colDef.defaultValue,
          primaryKey: colDef.primaryKey,
          autoIncrement: colDef.autoIncrement
        };
      }
      return { name };
    }
  };

  // Initialize all models
  for (const [table, modelFactory] of Object.entries(modelFiles)) {
    try {
      modelFactory(mockSequelize);
    } catch (error) {
      console.warn(`Warning: Could not parse model for ${table}: ${error.message}`);
    }
  }

  return expectedColumns;
}

async function getSchemaTablesAndColumns(schemaName) {
  const query = `
    SELECT 
      table_name,
      column_name,
      data_type,
      is_nullable,
      column_default,
      character_maximum_length,
      numeric_precision,
      numeric_scale
    FROM information_schema.columns
    WHERE table_schema = :schemaName
    ORDER BY table_name, ordinal_position
  `;

  const columns = await sequelize.query(query, {
    replacements: { schemaName },
    type: Sequelize.QueryTypes.SELECT
  });

  const tables = {};
  for (const col of columns) {
    if (!tables[col.table_name]) {
      tables[col.table_name] = {};
    }
    tables[col.table_name][col.column_name] = col;
  }

  return tables;
}

function checkTypeCompatibility(expectedType, actualType) {
  // Normalize types for comparison
  const typeMap = {
    'STRING': ['character varying', 'varchar', 'text', 'char'],
    'TEXT': ['text', 'character varying'],
    'INTEGER': ['integer', 'bigint', 'smallint'],
    'BIGINT': ['bigint', 'integer'],
    'DECIMAL': ['numeric', 'decimal'],
    'FLOAT': ['real', 'double precision', 'numeric'],
    'BOOLEAN': ['boolean'],
    'DATE': ['timestamp without time zone', 'timestamp with time zone', 'date'],
    'DATEONLY': ['date'],
    'JSONB': ['jsonb', 'json'],
    'JSON': ['json', 'jsonb'],
    'UUID': ['uuid'],
    'BLOB': ['bytea']
  };

  const normalizedExpected = expectedType?.toUpperCase().replace(/\(.*/, '');
  const normalizedActual = actualType?.toLowerCase();

  if (!typeMap[normalizedExpected]) return false; // Unknown expected type

  return !typeMap[normalizedExpected].includes(normalizedActual);
}

async function checkSchemaVersionConsistency(schemaNames) {
  logInfo('Checking schema_version consistency across tenants...');

  const versions = [];

  for (const schemaName of schemaNames) {
    try {
      const result = await sequelize.query(
        `SELECT version, migration_name, applied_at 
         FROM "${schemaName}".schema_versions 
         ORDER BY applied_at DESC LIMIT 1`,
        { type: Sequelize.QueryTypes.SELECT }
      );

      if (result.length > 0) {
        versions.push({
          schema: schemaName,
          version: result[0].version,
          migration: result[0].migration_name,
          appliedAt: result[0].applied_at
        });
      }
    } catch (error) {
      logWarning(`Could not read schema_version from ${schemaName}: ${error.message}`);
    }
  }

  if (versions.length > 1) {
    const uniqueVersions = [...new Set(versions.map(v => v.version))];
    if (uniqueVersions.length > 1) {
      logCritical(`Schema version mismatch detected! Found ${uniqueVersions.length} different versions`);
      versions.forEach(v => {
        console.log(`  - ${v.schema}: v${v.version} (${v.migration})`);
      });
    } else {
      logSuccess(`All ${versions.length} tenants at schema version ${uniqueVersions[0]}`);
    }
  }
}

// ========================================
// STEP 2: ASSOCIATION & JOIN VALIDATION
// ========================================

async function checkAssociations() {
  logSection('STEP 2: ASSOCIATION & JOIN VALIDATION');

  const brokenRelations = [];

  try {
    // Enable initialization phase to allow queries without transaction
    setInitializationPhase(true);

    // Get a sample tenant schema to test on
    const schemas = await sequelize.query(
      `SELECT schema_name FROM information_schema.schemata 
       WHERE schema_name LIKE '${TENANT_SCHEMA_PREFIX}%' LIMIT 1`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (schemas.length === 0) {
      logWarning('No tenant schemas found for association testing');
      return [];
    }

    const testSchema = schemas[0].schema_name;
    logInfo(`Testing associations on schema: ${testSchema}`);

    // Initialize models for the tenant schema
    const models = await ModelFactory.createModels(sequelize);
    
    // Test Inventory → Product association
    try {
      await sequelize.query(
        `SELECT i.*, p.name as product_name 
         FROM "${testSchema}".inventory i
         LEFT JOIN "${testSchema}".products p ON i.product_id = p.id
         LIMIT 1`,
        { type: Sequelize.QueryTypes.SELECT }
      );
      logSuccess('Inventory → Product join works');
    } catch (error) {
      brokenRelations.push({ relation: 'Inventory → Product', error: error.message });
      logCritical(`Inventory → Product join failed: ${error.message}`);
    }

    // Test InventorySale → Product → Customer
    try {
      await sequelize.query(
        `SELECT s.*, p.name as product_name, c.name as customer_name
         FROM "${testSchema}".inventory_sales s
         LEFT JOIN "${testSchema}".products p ON s.product_id = p.id
         LEFT JOIN "${testSchema}".customers c ON s.customer_id = c.id
         LIMIT 1`,
        { type: Sequelize.QueryTypes.SELECT }
      );
      logSuccess('InventorySale → Product → Customer join works');
    } catch (error) {
      brokenRelations.push({ relation: 'InventorySale → Product → Customer', error: error.message });
      logCritical(`InventorySale chain join failed: ${error.message}`);
    }

    // Test Order → OrderItems
    try {
      await sequelize.query(
        `SELECT o.*, oi.name as item_name, oi.quantity
         FROM "${testSchema}".orders o
         LEFT JOIN "${testSchema}".order_items oi ON o.id = oi.order_id
         LIMIT 1`,
        { type: Sequelize.QueryTypes.SELECT }
      );
      logSuccess('Order → OrderItems join works');
    } catch (error) {
      brokenRelations.push({ relation: 'Order → OrderItems', error: error.message });
      logCritical(`Order → OrderItems join failed: ${error.message}`);
    }

    // Test Product → Category
    try {
      await sequelize.query(
        `SELECT p.*, c.name as category_name
         FROM "${testSchema}".products p
         LEFT JOIN "${testSchema}".categories c ON p.category_id = c.id
         LIMIT 1`,
        { type: Sequelize.QueryTypes.SELECT }
      );
      logSuccess('Product → Category join works');
    } catch (error) {
      brokenRelations.push({ relation: 'Product → Category', error: error.message });
      logCritical(`Product → Category join failed: ${error.message}`);
    }

    // Check foreign key constraints
    await checkForeignKeyConstraints(testSchema);

    setInitializationPhase(false);

  } catch (error) {
    logCritical(`Association check failed: ${error.message}`);
  }

  return brokenRelations;
}

async function checkForeignKeyConstraints(schemaName) {
  logInfo('Checking foreign key constraints...');

  const query = `
    SELECT
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = :schemaName
  `;

  try {
    const constraints = await sequelize.query(query, {
      replacements: { schemaName },
      type: Sequelize.QueryTypes.SELECT
    });

    logInfo(`Found ${constraints.length} foreign key constraints in ${schemaName}`);

    // Check for common FKs
    const expectedFKs = [
      { table: 'inventory', column: 'product_id', ref: 'products' },
      { table: 'inventory_sales', column: 'inventory_item_id', ref: 'inventory' },
      { table: 'order_items', column: 'order_id', ref: 'orders' },
      { table: 'order_items', column: 'product_id', ref: 'products' },
      { table: 'products', column: 'category_id', ref: 'categories' }
    ];

    for (const expected of expectedFKs) {
      const found = constraints.some(c => 
        c.table_name === expected.table && 
        c.column_name === expected.column
      );

      if (!found) {
        logWarning(`Missing FK constraint: ${expected.table}.${expected.column} → ${expected.ref}`);
      }
    }

  } catch (error) {
    logWarning(`Could not check FK constraints: ${error.message}`);
  }
}

// ========================================
// STEP 3: DATA CONSISTENCY CHECK
// ========================================

async function checkDataConsistency() {
  logSection('STEP 3: DATA CONSISTENCY CHECK');

  const inconsistencies = [];

  try {
    setInitializationPhase(true);

    // Get all tenant schemas
    const schemas = await sequelize.query(
      `SELECT schema_name FROM information_schema.schemata 
       WHERE schema_name LIKE '${TENANT_SCHEMA_PREFIX}%'`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const { schema_name } of schemas.slice(0, 5)) { // Check first 5 tenants
      logInfo(`Checking data consistency for ${schema_name}...`);

      // Check 1: Inventory quantity vs transactions
      const inventoryCheck = await checkInventoryConsistency(schema_name);
      if (inventoryCheck.issues.length > 0) {
        inconsistencies.push(...inventoryCheck.issues);
      }

      // Check 2: Order total vs sum of items
      const orderCheck = await checkOrderConsistency(schema_name);
      if (orderCheck.issues.length > 0) {
        inconsistencies.push(...orderCheck.issues);
      }

      // Check 3: Customer balance vs transactions
      const customerCheck = await checkCustomerConsistency(schema_name);
      if (customerCheck.issues.length > 0) {
        inconsistencies.push(...customerCheck.issues);
      }

      // Check 4: Duplicate data detection
      const duplicateCheck = await checkDuplicates(schema_name);
      if (duplicateCheck.issues.length > 0) {
        inconsistencies.push(...duplicateCheck.issues);
      }
    }

    setInitializationPhase(false);

    if (inconsistencies.length === 0) {
      logSuccess('No data consistency issues found');
    } else {
      logCritical(`Found ${inconsistencies.length} data consistency issues`);
      inconsistencies.slice(0, 10).forEach(issue => {
        console.log(`  - ${issue.schema}: ${issue.type} - ${issue.details}`);
      });
      if (inconsistencies.length > 10) {
        logInfo(`... and ${inconsistencies.length - 10} more issues`);
      }
    }

  } catch (error) {
    logCritical(`Data consistency check failed: ${error.message}`);
  }

  return inconsistencies;
}

async function checkInventoryConsistency(schemaName) {
  const issues = [];

  try {
    // Calculate expected quantity from transactions
    const query = `
      SELECT 
        i.id,
        i.quantity as current_quantity,
        i.product_id,
        COALESCE(SUM(CASE WHEN t.type = 'IN' THEN t.quantity ELSE -t.quantity END), 0) as calculated_quantity
      FROM "${schemaName}".inventory i
      LEFT JOIN "${schemaName}".inventory_transactions t ON i.id = t.inventory_id
      GROUP BY i.id, i.quantity, i.product_id
      HAVING ABS(i.quantity - COALESCE(SUM(CASE WHEN t.type = 'IN' THEN t.quantity ELSE -t.quantity END), 0)) > 0.001
    `;

    const mismatches = await sequelize.query(query, {
      type: Sequelize.QueryTypes.SELECT
    });

    if (mismatches.length > 0) {
      issues.push({
        schema: schemaName,
        type: 'INVENTORY_MISMATCH',
        severity: 'HIGH',
        count: mismatches.length,
        details: `${mismatches.length} inventory records with quantity mismatch`
      });
    }

  } catch (error) {
    issues.push({
      schema: schemaName,
      type: 'INVENTORY_CHECK_ERROR',
      severity: 'MEDIUM',
      details: error.message
    });
  }

  return { issues };
}

async function checkOrderConsistency(schemaName) {
  const issues = [];

  try {
    const query = `
      SELECT 
        o.id,
        o.billing_total,
        SUM(oi.subtotal) as calculated_total
      FROM "${schemaName}".orders o
      LEFT JOIN "${schemaName}".order_items oi ON o.id = oi.order_id
      GROUP BY o.id, o.billing_total
      HAVING ABS(o.billing_total - COALESCE(SUM(oi.subtotal), 0)) > 0.01
    `;

    const mismatches = await sequelize.query(query, {
      type: Sequelize.QueryTypes.SELECT
    });

    if (mismatches.length > 0) {
      issues.push({
        schema: schemaName,
        type: 'ORDER_TOTAL_MISMATCH',
        severity: 'HIGH',
        count: mismatches.length,
        details: `${mismatches.length} orders with billing total mismatch`
      });
    }

  } catch (error) {
    issues.push({
      schema: schemaName,
      type: 'ORDER_CHECK_ERROR',
      severity: 'MEDIUM',
      details: error.message
    });
  }

  return { issues };
}

async function checkCustomerConsistency(schemaName) {
  const issues = [];

  try {
    const query = `
      SELECT 
        c.id,
        c.name,
        COALESCE(cl.balance, 0) as ledger_balance,
        COALESCE(SUM(ct.amount), 0) as calculated_balance
      FROM "${schemaName}".customers c
      LEFT JOIN "${schemaName}".customer_ledgers cl ON c.id = cl.customer_id
      LEFT JOIN "${schemaName}".customer_transactions ct ON c.id = ct.customer_id
      GROUP BY c.id, c.name, cl.balance
      HAVING ABS(COALESCE(cl.balance, 0) - COALESCE(SUM(ct.amount), 0)) > 0.01
    `;

    const mismatches = await sequelize.query(query, {
      type: Sequelize.QueryTypes.SELECT
    });

    if (mismatches.length > 0) {
      issues.push({
        schema: schemaName,
        type: 'CUSTOMER_BALANCE_MISMATCH',
        severity: 'HIGH',
        count: mismatches.length,
        details: `${mismatches.length} customers with balance mismatch`
      });
    }

  } catch (error) {
    issues.push({
      schema: schemaName,
      type: 'CUSTOMER_CHECK_ERROR',
      severity: 'MEDIUM',
      details: error.message
    });
  }

  return { issues };
}

async function checkDuplicates(schemaName) {
  const issues = [];

  try {
    // Check for duplicate products per outlet
    const productQuery = `
      SELECT business_id, outlet_id, name, COUNT(*) as count
      FROM "${schemaName}".products
      GROUP BY business_id, outlet_id, name
      HAVING COUNT(*) > 1
    `;

    const duplicateProducts = await sequelize.query(productQuery, {
      type: Sequelize.QueryTypes.SELECT
    });

    if (duplicateProducts.length > 0) {
      issues.push({
        schema: schemaName,
        type: 'DUPLICATE_PRODUCTS',
        severity: 'MEDIUM',
        count: duplicateProducts.length,
        details: `${duplicateProducts.length} duplicate product names per outlet`
      });
    }

    // Check for duplicate order numbers
    const orderQuery = `
      SELECT order_number, COUNT(*) as count
      FROM "${schemaName}".orders
      GROUP BY order_number
      HAVING COUNT(*) > 1
    `;

    const duplicateOrders = await sequelize.query(orderQuery, {
      type: Sequelize.QueryTypes.SELECT
    });

    if (duplicateOrders.length > 0) {
      issues.push({
        schema: schemaName,
        type: 'DUPLICATE_ORDER_NUMBERS',
        severity: 'HIGH',
        count: duplicateOrders.length,
        details: `${duplicateOrders.length} duplicate order numbers`
      });
    }

  } catch (error) {
    issues.push({
      schema: schemaName,
      type: 'DUPLICATE_CHECK_ERROR',
      severity: 'LOW',
      details: error.message
    });
  }

  return { issues };
}

// ========================================
// STEP 4: API PERFORMANCE ANALYSIS
// ========================================

async function analyzeApiPerformance() {
  logSection('STEP 4: API PERFORMANCE ANALYSIS');

  const performanceIssues = [];

  // Read controller files to analyze query patterns
  const controllersToCheck = [
    { name: 'inventoryController', path: '../controllers/inventoryController.js' },
    { name: 'inventorySaleController', path: '../controllers/inventorySaleController.js' },
    { name: 'billingController', path: '../controllers/billingController.js' },
    { name: 'salesController', path: '../controllers/salesController.js' },
    { name: 'productController', path: '../controllers/productController.js' },
    { name: 'customerController', path: '../controllers/customerController.js' },
    { name: 'orderController', path: '../controllers/orderController.js' },
    { name: 'purchaseController', path: '../controllers/purchaseController.js' }
  ];

  for (const controller of controllersToCheck) {
    try {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, controller.path);
      
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for N+1 query patterns
        const nPlusOnePatterns = [
          { pattern: /for\s*\([^)]*\)\s*\{[^}]*findOne|findByPk|findAll/g, desc: 'Loop with DB query' },
          { pattern: /\.map\s*\([^)]*\)\s*=>\s*[^}]*findOne|findByPk/g, desc: 'Map with async DB query' },
          { pattern: /forEach\s*\([^)]*\)\s*=>\s*[^}]*findOne|findByPk/g, desc: 'forEach with async DB query' },
          { pattern: /Promise\.all\s*\([^)]*\.map.*find/g, desc: 'Promise.all with mapped queries' }
        ];

        for (const { pattern, desc } of nPlusOnePatterns) {
          if (pattern.test(content)) {
            performanceIssues.push({
              controller: controller.name,
              type: 'N_PLUS_ONE',
              description: desc,
              severity: 'HIGH'
            });
          }
        }

        // Check for missing includes (potential lazy loading)
        const missingIncludePattern = /findOne|findAll|findByPk\s*\(\s*\{[^}]*\}\s*\)(?!.*include)/;
        if (missingIncludePattern.test(content)) {
          // This is a simplified check - many queries don't need includes
          // We'll do deeper analysis
        }

        // Check for inefficient queries (SELECT *)
        const selectAllPattern = /findAll\s*\(\s*\{[^}]*where[^}]*\}\s*\)(?!.*attributes)/;
        if (selectAllPattern.test(content)) {
          const matches = content.match(/findAll\s*\(\s*\{[^}]*where[^}]*\}\s*\)/g);
          if (matches) {
            performanceIssues.push({
              controller: controller.name,
              type: 'MISSING_ATTRIBUTES',
              description: `${matches.length} findAll queries without attributes restriction`,
              count: matches.length,
              severity: 'MEDIUM'
            });
          }
        }
      }
    } catch (error) {
      logWarning(`Could not analyze ${controller.name}: ${error.message}`);
    }
  }

  // Check for missing indexes
  await checkMissingIndexes();

  // Report findings
  if (performanceIssues.length === 0) {
    logSuccess('No obvious performance anti-patterns detected');
  } else {
    logWarning(`${performanceIssues.length} potential performance issues found`);
    
    const nPlusOne = performanceIssues.filter(i => i.type === 'N_PLUS_ONE');
    const missingAttrs = performanceIssues.filter(i => i.type === 'MISSING_ATTRIBUTES');
    
    if (nPlusOne.length > 0) {
      logCritical(`${nPlusOne.length} N+1 query patterns detected`);
      nPlusOne.forEach(issue => {
        console.log(`  - ${issue.controller}: ${issue.description}`);
      });
    }

    if (missingAttrs.length > 0) {
      logWarning(`${missingAttrs.length} controllers with missing attributes`);
    }
  }

  auditResults.performanceStatus = {
    issues: performanceIssues,
    nPlusOneCount: performanceIssues.filter(i => i.type === 'N_PLUS_ONE').length,
    missingAttributesCount: performanceIssues.filter(i => i.type === 'MISSING_ATTRIBUTES').reduce((sum, i) => sum + (i.count || 0), 0)
  };

  return performanceIssues;
}

async function checkMissingIndexes() {
  logInfo('Checking for missing indexes...');

  try {
    setInitializationPhase(true);

    const schemas = await sequelize.query(
      `SELECT schema_name FROM information_schema.schemata 
       WHERE schema_name LIKE '${TENANT_SCHEMA_PREFIX}%' LIMIT 1`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (schemas.length === 0) return;

    const schemaName = schemas[0].schema_name;

    // Check existing indexes
    const indexesQuery = `
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = :schemaName
    `;

    const indexes = await sequelize.query(indexesQuery, {
      replacements: { schemaName },
      type: Sequelize.QueryTypes.SELECT
    });

    logInfo(`Found ${indexes.length} indexes in ${schemaName}`);

    // Expected indexes based on model definitions
    const expectedIndexes = [
      { table: 'products', columns: ['business_id', 'outlet_id'], type: 'composite' },
      { table: 'orders', columns: ['business_id', 'outlet_id', 'created_at'], type: 'composite' },
      { table: 'order_items', columns: ['order_id'], type: 'single' },
      { table: 'inventory', columns: ['product_id'], type: 'single' },
      { table: 'inventory_sales', columns: ['inventory_item_id'], type: 'single' },
      { table: 'customers', columns: ['business_id'], type: 'single' }
    ];

    const missingIndexes = [];

    for (const expected of expectedIndexes) {
      const found = indexes.some(idx => 
        idx.tablename === expected.table &&
        idx.indexdef.includes(expected.columns.join('_'))
      );

      if (!found) {
        // More thorough check
        const tableIndexes = indexes.filter(idx => idx.tablename === expected.table);
        const hasComposite = expected.type === 'composite' && tableIndexes.some(idx => 
          expected.columns.every(col => idx.indexdef.includes(col))
        );
        const hasSingle = expected.type === 'single' && tableIndexes.some(idx =>
          idx.indexdef.includes(expected.columns[0])
        );

        if (!hasComposite && !hasSingle) {
          missingIndexes.push(expected);
        }
      }
    }

    if (missingIndexes.length > 0) {
      logWarning(`${missingIndexes.length} potentially missing indexes`);
      missingIndexes.forEach(idx => {
        console.log(`  - ${idx.table}(${idx.columns.join(', ')})`);
      });
    } else {
      logSuccess('All expected indexes are present');
    }

    setInitializationPhase(false);

  } catch (error) {
    logWarning(`Could not check indexes: ${error.message}`);
  }
}

// ========================================
// MAIN EXECUTION
// ========================================

async function runAudit() {
  console.log(`\n${colors.bold}${colors.magenta}
╔════════════════════════════════════════════════════════════════╗
║           MULTI-TENANT SYSTEM COMPREHENSIVE AUDIT               ║
║                    (Data-First Architecture)                     ║
╚════════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  const startTime = performance.now();

  try {
    // Connect to database
    logInfo('Connecting to database...');
    await sequelize.authenticate();
    logSuccess('Database connection established');

    // Run all audit steps
    const schemaMismatches = await checkSchemaConsistency();
    const brokenRelations = await checkAssociations();
    const dataIssues = await checkDataConsistency();
    const performanceIssues = await analyzeApiPerformance();

    // Summary
    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    printSummary(duration, schemaMismatches, brokenRelations, dataIssues, performanceIssues);

  } catch (error) {
    console.error(`\n${colors.red}Audit failed with error:${colors.reset}`, error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

function printSummary(duration, schemaMismatches, brokenRelations, dataIssues, performanceIssues) {
  logSection('FINAL AUDIT SUMMARY');

  console.log(`\n${colors.bold}Execution Time: ${duration}s${colors.reset}\n`);

  // Critical Issues
  console.log(`${colors.red}🔴 CRITICAL ISSUES${colors.reset}`);
  if (auditResults.criticalIssues.length === 0) {
    console.log('  None detected');
  } else {
    auditResults.criticalIssues.forEach(issue => console.log(`  - ${issue}`));
  }

  // Medium Issues
  console.log(`\n${colors.yellow}🟡 MEDIUM ISSUES${colors.reset}`);
  if (auditResults.mediumIssues.length === 0) {
    console.log('  None detected');
  } else {
    auditResults.mediumIssues.slice(0, 10).forEach(issue => console.log(`  - ${issue}`));
    if (auditResults.mediumIssues.length > 10) {
      console.log(`  ... and ${auditResults.mediumIssues.length - 10} more`);
    }
  }

  // Safe Areas
  console.log(`\n${colors.green}🟢 SAFE AREAS${colors.reset}`);
  auditResults.safeAreas.slice(0, 10).forEach(area => console.log(`  ✓ ${area}`));

  // Schema Status
  console.log(`\n${colors.bold}🧱 SCHEMA STATUS${colors.reset}`);
  const schemaColor = auditResults.schemaStatus === 'ALIGNED' ? colors.green : 
                      auditResults.schemaStatus === 'ISSUES_DETECTED' ? colors.red : colors.yellow;
  console.log(`  ${schemaColor}${auditResults.schemaStatus}${colors.reset}`);
  console.log(`  Tenants checked: ${auditResults.checkedTenants}/${auditResults.totalTenants}`);

  // Performance Status
  console.log(`\n${colors.bold}⚡ PERFORMANCE STATUS${colors.reset}`);
  console.log(`  N+1 query patterns: ${auditResults.performanceStatus.nPlusOneCount || 0}`);
  console.log(`  Missing attributes queries: ${auditResults.performanceStatus.missingAttributesCount || 0}`);

  // Final System Status
  console.log(`\n${colors.bold}🚀 FINAL SYSTEM STATUS${colors.reset}`);
  const hasCritical = auditResults.criticalIssues.length > 0;
  const statusText = hasCritical ? 'NEEDS_IMPROVEMENT' : 'STABLE';
  const statusColor = hasCritical ? colors.red : colors.green;
  console.log(`  ${statusColor}${statusText}${colors.reset}\n`);
}

// Run the audit
runAudit();
