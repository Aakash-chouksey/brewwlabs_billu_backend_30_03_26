/**
 * TENANT MODEL LOADER
 * 
 * Production-grade multi-tenant model initialization
 * Properly binds models to tenant schemas with full PgBouncer compatibility
 */

const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const { enforceSchema, securityCheck } = require('../utils/schemaEnforcement');
const { CONTROL_PLANE, CONTROL_MODELS, TENANT_MODELS } = require('../utils/constants');

// 🔒 GUARD: Prevent modification of classification lists
Object.freeze(CONTROL_MODELS);
Object.freeze(TENANT_MODELS);

// Model loading order (dependency-based) - ONLY tenant models
// Names must match the keys in TENANT_MODELS
// 🚀 OPTIMIZED: 8 Granular levels to handle parallel sync foreign key dependencies correctly
const MODEL_LOAD_ORDER = [
    // Level 1: THE absolute root
    ['Outlet'],

    // Level 2: Root Configs & Metadata (depend on Outlet)
    ['Setting', 'FeatureFlag', 'WebContent', 'OperationTiming', 'TenantAuditLog'],
    
    // Level 3: Core Configs (depend mainly on Outlet/Metadata)
    ['Category', 'Area', 'ProductType', 'InventoryCategory', 'Customer', 'Supplier', 
     'ExpenseType', 'BillingConfig', 'Timing', 'MembershipPlan', 'PartnerType', 'Account'],
    
    // Level 4: Base Transactional Nodes (depend on Level 3)
    ['Product', 'Table', 'PartnerMembership', 'PartnerWallet', 'Expense', 'Income', 'Wastage', 'RollTracking'],
    
    // Level 5: Complex Transactional Nodes (depend on Level 4)
    ['Order', 'Recipe', 'Purchase', 'Inventory', 'InventoryItem'],
    
    // Level 6: Transactional Supporting Nodes (depend on Level 5)
    ['Payment', 'StockTransaction', 'CustomerTransaction'],
    
    // Level 7: Transactional Details (depend on Level 5/6)
    ['OrderItem', 'RecipeItem', 'PurchaseItem', 'InventoryTransaction'],
    
    // Level 8: Transactional Ledgers & History (depend on Level 6/7)
    ['CustomerLedger', 'InventorySale', 'AccountTransaction']
];

// Model file mapping - ONLY tenant models (control models excluded)
const MODEL_FILES = {
    Product: 'productModel',
    Category: 'categoryModel',
    Order: 'orderModel',
    OrderItem: 'orderItemModel',
    Inventory: 'inventoryModel',
    InventoryItem: 'inventoryItemModel',
    InventoryTransaction: 'inventoryTransactionModel',
    Account: 'accountModel',
    AccountTransaction: 'accountTransactionModel',
    Transaction: 'transactionModel',
    Outlet: 'outletModel',
    Area: 'areaModel',
    Table: 'tableModel',
    Recipe: 'recipeModel',
    RecipeItem: 'recipeItemModel',
    Supplier: 'supplierModel',
    Purchase: 'purchaseModel',
    PurchaseItem: 'purchaseItemModel',
    Expense: 'expenseModel',
    ExpenseType: 'expenseTypeModel',
    Income: 'incomeModel',
    Payment: 'paymentModel',
    Timing: 'timingModel',
    Setting: 'settingModel',
    BillingConfig: 'billingConfigModel',
    MembershipPlan: 'membershipPlanModel',
    PartnerType: 'partnerTypeModel',
    PartnerMembership: 'partnerMembershipModel',
    PartnerWallet: 'partnerWalletModel',
    RollTracking: 'rollTrackingModel',
    FeatureFlag: 'featureFlagModel',
    WebContent: 'webContentModel',
    ProductType: 'productTypeModel',
    InventoryCategory: 'inventoryCategoryModel',
    TenantAuditLog: 'tenantAuditLogModel',
    Customer: 'customerModel',
    CustomerTransaction: 'customerTransactionModel',
    CustomerLedger: 'customerLedgerModel',
    StockTransaction: 'stockTransactionModel',
    InventorySale: 'inventorySaleModel',
    Wastage: 'wastageModel',
    OperationTiming: 'operationTimingModel'
};

// 🔒 GUARD: Control plane models (public schema ONLY) - DEPRECATED, use CONTROL_MODELS
const CONTROL_PLANE_MODELS = CONTROL_MODELS;

class TenantModelLoader {
    constructor() {
        this.modelCache = new Map();
        this.modelDefinitions = new Map();
    }

    /**
     * Initialize all model definitions (one-time load)
     */
    loadModelDefinitions() {
        if (this.modelDefinitions.size > 0) {
            return; // Already loaded
        }

        console.log('[TenantModelLoader] Loading model definitions...');

        for (const [modelName, fileName] of Object.entries(MODEL_FILES)) {
            try {
                const definition = require(path.join(__dirname, '../../models', fileName));
                this.modelDefinitions.set(modelName, definition);
            } catch (error) {
                console.error(`[TenantModelLoader] ❌ Failed to load ${modelName}:`, error.message);
            }
        }

        console.log(`[TenantModelLoader] ✅ Loaded ${this.modelDefinitions.size} model definitions`);
    }

    /**
     * ===================================================================
     * 🚀 NEW: FAST SCHEMA INITIALIZATION (For Onboarding Only)
     * ===================================================================
     * 
     * Creates schema and tables in PARALLEL - optimized for < 1 second onboarding
     * - Parallel table creation using Promise.all
     * - Single verification query instead of per-table
     * - Runs ONLY during onboarding, never during API requests
     */
    async initializeTenantSchema(sequelize, schemaName) {
        const startTime = Date.now();
        console.log(`[TenantModelLoader] 🚀 FAST SCHEMA INIT: ${schemaName}`);

        // 1. Ensure models are initialized
        const { ModelFactory } = require('./modelFactory');
        await ModelFactory.createModels(sequelize);

        // 2. Create schema and set timeout
        await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
        await sequelize.query(`SET LOCAL statement_timeout = '3min'`);
        console.log(`[TenantModelLoader] ✅ Schema created and timeout set: ${schemaName}`);

        // 3. Get all tenant models - MUST wait for ModelFactory to create all models
        const tenantModels = {};
        const allModelNames = Object.keys(sequelize.models);
        console.log(`[TenantModelLoader] 📊 Total models in sequelize: ${allModelNames.length}`);
        
        for (const modelName of allModelNames) {
            const model = sequelize.models[modelName];
            if (CONTROL_MODELS.includes(modelName)) {
                continue; // Skip control models
            }
            // All non-control models are tenant models
            tenantModels[modelName] = model.schema(schemaName);
        }
        
        console.log(`[TenantModelLoader] 📊 Tenant models collected: ${Object.keys(tenantModels).length}`);
        
        // 🔒 VALIDATION: Ensure all models in MODEL_LOAD_ORDER exist in sequelize
        const flatOrder = MODEL_LOAD_ORDER.flat();
        const missingFromRegistry = flatOrder.filter(name => !tenantModels[name]);
        if (missingFromRegistry.length > 0) {
            console.error(`[TenantModelLoader] 🚨 CRITICAL: Models in MODEL_LOAD_ORDER missing from registry: ${missingFromRegistry.join(', ')}`);
            throw new Error(`Incomplete Model Registry: ${missingFromRegistry.join(', ')}`);
        }

        // 4. PARALLEL TABLE CREATION
        const createdTables = [];
        const existingTables = [];
        const failedTables = [];

        // Get existing tables in ONE query
        const existingResult = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = :schema AND table_type = 'BASE TABLE'
        `, {
            replacements: { schema: schemaName },
            type: sequelize.QueryTypes.SELECT
        });
        const existingTableNames = new Set(existingResult.map(t => t.table_name));

        // Process each level in parallel
        for (const level of MODEL_LOAD_ORDER) {
            const modelsToSync = level
                .map(name => tenantModels[name])
                .filter(model => {
                    if (!model) return false;
                    const tableName = model.getTableName();
                    return !existingTableNames.has(tableName);
                });

            if (modelsToSync.length === 0) continue;

            // 🔥 PARALLEL SYNC
            const syncResults = await Promise.all(
                modelsToSync.map(async (model) => {
                    const tableName = model.getTableName();
                    try {
                        await model.sync({ force: false, alter: false, schema: schemaName });
                        return { success: true, tableName };
                    } catch (error) {
                        if (error.message?.includes('already exists')) {
                            return { success: true, tableName, existing: true };
                        }
                        return { success: false, tableName, error: error.message };
                    }
                })
            );
            syncResults.forEach(result => {
                if (result.success) {
                    if (result.existing) existingTables.push(result.tableName);
                    else createdTables.push(result.tableName);
                } else {
                    failedTables.push({ name: result.tableName, error: result.error });
                }
            });

            // 🚨 FAIL-FAST: Stop immediately if any table in this level failed
            if (failedTables.length > 0) {
                const failedInThisLevel = syncResults
                    .filter(r => !r.success)
                    .map(r => typeof r.tableName === 'string' ? r.tableName : (r.tableName.tableName || 'unknown'));
                
                if (failedInThisLevel.length > 0) {
                    const error = new Error(`SCHEMA SYNC FAILED at level nodes: ${failedInThisLevel.join(', ')}. First error: ${failedTables[0].error}`);
                    console.error(`[TenantModelLoader] 🚨 ${error.message}`);
                    throw error;
                }
            }
            
            console.log(`[TenantModelLoader]   ✅ Level verified: ${level.join(', ')}`);
        }
        
        const duration = Date.now() - startTime;
        console.log(`[TenantModelLoader] ✅ SCHEMA INIT COMPLETE: ${schemaName} in ${duration}ms`);
        console.log(`   - Created: ${createdTables.length} tables`);
        console.log(`   - Existing: ${existingTables.length} tables`);

        return {
            schemaName,
            models: tenantModels,
            created: createdTables,
            existing: existingTables,
            failed: failedTables,
            duration
        };
    }

    /**
     * ===================================================================
     * OPTIMIZED: Bind models to schema (NO SYNC - Request Flow Only)
     * ===================================================================
     * This is called during API requests - it ONLY binds models, never syncs
     */
    async initTenantModels(sequelize, schemaName) {
        enforceSchema(schemaName);
        
        // 1. Check cache first
        const cacheKey = `${schemaName}_${sequelize.options.host}`;
        if (this.modelCache.has(cacheKey)) {
            return this.modelCache.get(cacheKey);
        }

        // 2. Ensure models are initialized
        const { ModelFactory } = require('./modelFactory');
        await ModelFactory.createModels(sequelize);

        console.log(`[TenantModelLoader] 🔗 Binding models to schema: ${schemaName} (NO SYNC)`);

        // 3. Bind models to schema (NO table creation - assumes tables exist)
        const models = {};
        for (const [modelName, model] of Object.entries(sequelize.models)) {
            try {
                if (CONTROL_MODELS.includes(modelName)) {
                    if (schemaName !== 'public') continue;
                }
                if (TENANT_MODELS.includes(modelName)) {
                    if (schemaName === 'public') continue;
                }

                const schemaBoundModel = model.schema(schemaName);
                models[modelName] = schemaBoundModel;
                
            } catch (error) {
                console.error(`[TenantModelLoader]   ❌ Failed to bind ${modelName}:`, error.message);
            }
        }

        // 4. Cache and return (NO sync, NO verification)
        this.modelCache.set(cacheKey, models);
        Object.freeze(models);
        
        console.log(`[TenantModelLoader] ✅ Models bound: ${Object.keys(models).length} models for ${schemaName}`);
        return models;
    }

    /**
     * Setup associations between models
     */
    setupAssociations(models, schemaName) {
        for (const [modelName, model] of Object.entries(models)) {
            if (typeof model.associate === 'function') {
                try {
                    model.associate(models);
                    console.log(`[TenantModelLoader]   🔗 Associated: ${modelName}`);
                } catch (error) {
                    console.warn(`[TenantModelLoader]   ⚠️  Association error for ${modelName}:`, error.message);
                }
            }
        }
    }

/**
     * Sync models to create tables in tenant schema
     * CRITICAL: NO search_path manipulation - uses explicit schema binding only
     */
    async syncModels(models, sequelize, schemaName) {
        const results = {
            created: [],
            existing: [],
            failed: []
        };

        // Get existing tables in schema - MANUAL QUERY for accuracy
        const tables = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = :schema
            AND table_type = 'BASE TABLE'
        `, {
            replacements: { schema: schemaName },
            type: sequelize.QueryTypes.SELECT
        });
        
        const existingTables = tables.map(t => t.table_name);
        console.log(`[TenantModelLoader] 📊 [SYNC] Found ${existingTables.length} existing tables in '${schemaName}'`);
        
        const startTime = Date.now();

        // Process models in order
        for (const level of MODEL_LOAD_ORDER) {
            for (const modelName of level) {
                const model = models[modelName];
                if (!model) continue;

                const rawTableName = model.getTableName();
                const tableName = typeof rawTableName === 'string' ? rawTableName : rawTableName.tableName;
                
                try {
                    if (existingTables.includes(tableName)) {
                        console.log(`[TenantModelLoader]   ⏭️  Table exists: ${tableName}`);
                        results.existing.push(tableName);
                        continue;
                    }

                    // CRITICAL: Use model.sync with explicit schema - NO search_path
                    await model.sync({ 
                        force: false, 
                        alter: false,
                        schema: schemaName
                    });
                    
                    console.log(`[TenantModelLoader]   ✅ Created: ${tableName}`);
                    results.created.push(tableName);
                    
                    // Verify table was created - MANUAL QUERY
                    const vTables = await sequelize.query(`
                        SELECT table_name FROM information_schema.tables 
                        WHERE table_schema = :schema AND table_name = :table
                    `, {
                        replacements: { schema: schemaName, table: tableName },
                        type: sequelize.QueryTypes.SELECT
                    });
                    
                    if (!vTables.length) {
                        console.warn(`[TenantModelLoader]   ⚠️  Table creation unverified: ${tableName}`);
                    }

                } catch (error) {
                    // Check if error is "table already exists"
                    if (error.message?.includes('already exists') || 
                        error.original?.message?.includes('already exists')) {
                        console.log(`[TenantModelLoader]   ⏭️  Table exists (from error): ${tableName}`);
                        results.existing.push(tableName);
                    } else {
                        console.error(`[TenantModelLoader]   ❌ Failed: ${tableName}:`, error.message);
                        results.failed.push({ name: tableName, error: error.message });
                    }
                }
            }
        }

        const duration = Date.now() - startTime;
        console.log(`[TenantModelLoader] ✅ [SYNC COMPLETE] ${schemaName} in ${duration}ms`);
        return results;
    }

    /**
     * Get cached models or initialize new ones
     */
    async getTenantModels(sequelize, schemaName) {
        const cacheKey = `${schemaName}_${sequelize.options.host}`;
        
        if (this.modelCache.has(cacheKey)) {
            return this.modelCache.get(cacheKey);
        }
        
        return await this.initTenantModels(sequelize, schemaName);
    }

    /**
     * Clear cache for a specific schema or all schemas
     */
    clearCache(schemaName = null) {
        if (schemaName) {
            for (const [key] of this.modelCache) {
                if (key.startsWith(`${schemaName}_`)) {
                    this.modelCache.delete(key);
                }
            }
            console.log(`[TenantModelLoader] 🧹 Cleared cache for ${schemaName}`);
        } else {
            this.modelCache.clear();
            console.log('[TenantModelLoader] 🧹 Cleared all model cache');
        }
    }

    /**
     * ===================================================================
     * 🛡️ ADVANCED: SCHEMA INTEGRITY VERIFICATION (Column-Level)
     * ===================================================================
     * 
     * Validates that all models have their corresponding tables AND columns 
     * correctly defined in the tenant schema.
     */
    async verifySchemaIntegrity(sequelize, schemaName) {
        const startTime = Date.now();
        console.log(`[TenantModelLoader] 🛡️ Verifying schema integrity: ${schemaName}`);

        // 1. Get all required models that should be in tenant schema
        const { TENANT_MODELS } = require('../utils/constants');
        const requiredModels = Object.entries(sequelize.models)
            .filter(([name]) => TENANT_MODELS.includes(name))
            .map(([name, model]) => ({ name, model }));

        // 2. Fetch ALL columns for this schema in ONE query for performance
        const columnsResult = await sequelize.query(`
            SELECT table_name, column_name 
            FROM information_schema.columns 
            WHERE table_schema = :schema
        `, {
            replacements: { schema: schemaName },
            type: sequelize.QueryTypes.SELECT
        });

        // Group columns by table for fast lookup
        const tableColumns = {};
        columnsResult.forEach(row => {
            const table = row.table_name.toLowerCase();
            if (!tableColumns[table]) tableColumns[table] = new Set();
            tableColumns[table].add(row.column_name.toLowerCase());
        });

        const report = {
            schemaName,
            isValid: true,
            missingTables: [],
            missingColumns: [],
            issues: 0
        };

        // 3. Audit each model
        for (const { name, model } of requiredModels) {
            const rawTableName = model.getTableName();
            const tableName = (typeof rawTableName === 'string' ? rawTableName : rawTableName.tableName).toLowerCase();
            
            // A. Check table existence
            if (!tableColumns[tableName]) {
                report.missingTables.push(name);
                report.issues++;
                report.isValid = false;
                continue;
            }

            // B. Check column existence
            const modelAttributes = model.getAttributes ? model.getAttributes() : model.rawAttributes;
            const existingCols = tableColumns[tableName];
            
            for (const [attrName, attr] of Object.entries(modelAttributes)) {
                const fieldName = (attr.field || attrName).toLowerCase();
                
                // Skip virtual fields or those without physical storage
                if (attr.type instanceof DataTypes.VIRTUAL) continue;

                if (!existingCols.has(fieldName)) {
                    report.missingColumns.push(`${name}.${attrName} (${fieldName})`);
                    report.issues++;
                    report.isValid = false;
                }
            }
        }

        const duration = Date.now() - startTime;
        console.log(`[TenantModelLoader] integrity check for ${schemaName} completed in ${duration}ms. Issues: ${report.issues}`);
        
        return report;
    }

    /**
     * REPAIR SCHEMA: Force-sync with 'alter: true'
     * 🛡️ Use specifically for onboarding recovery or maintenance
     */
    async repairTenantSchema(sequelize, schemaName) {
        console.log(`[TenantModelLoader] 🛠️ REPAIRING SCHEMA: ${schemaName}`);
        
        // Ensure models are bound to this schema
        const tenantModels = await this.getTenantModels(sequelize, schemaName);
        
        // Sync with 'alter: true' for ALL tenant models
        // Using the MODEL_LOAD_ORDER to respect foreign keys
        for (const level of MODEL_LOAD_ORDER) {
            await Promise.all(level.map(async (modelName) => {
                const model = tenantModels[modelName];
                if (!model) return;
                
                try {
                    await model.sync({ force: false, alter: true, schema: schemaName });
                } catch (error) {
                    console.error(`[TenantModelLoader] ❌ Repair failed for ${modelName}:`, error.message);
                }
            }));
        }

        // Final verification after repair
        return await this.verifySchemaIntegrity(sequelize, schemaName);
    }

    /**
     * DEPRECATED: Use verifySchemaIntegrity for better accuracy
     */
    async verifyTablesExist(sequelize, schemaName, requiredTables) {
        return this.verifySchemaIntegrity(sequelize, schemaName);
    }
}

// Export singleton
const tenantModelLoader = new TenantModelLoader();

// 🔒 FREEZE: Lock the model cache to prevent modification
Object.freeze(tenantModelLoader.modelCache);

module.exports = tenantModelLoader;
