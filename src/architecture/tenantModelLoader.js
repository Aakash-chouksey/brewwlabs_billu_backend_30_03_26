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
    // Level 1: THE absolute roots (No dependencies)
    ['Outlet', 'SchemaVersion', 'Supplier', 'InventoryCategory', 'ExpenseType', 'FeatureFlag'],
    
    // Level 2: Second-tier roots (Depend on Outlet)
    ['Category', 'Setting', 'WebContent', 'OperationTiming', 'TenantAuditLog', 'PartnerType'],
    
    // Level 3: Configs depending on Level 2 (e.g. ProductType depends on Category)
    ['ProductType', 'Area', 'Customer', 'BillingConfig', 'Timing', 'MembershipPlan', 'Account'],
    
    // Level 4: Entities depending on Level 3
    ['Product', 'Table', 'PartnerMembership', 'PartnerWallet', 'RollTracking'],
    
    // Level 5: Primary Transactional Roots
    ['Inventory', 'InventoryItem', 'Order', 'Recipe'],
    
    // Level 6: Second-tier Transactional Nodes
    ['Wastage', 'Purchase', 'Expense', 'Income', 'Payment', 'StockTransaction', 'CustomerTransaction'],
    
    // Level 7: Detailed Line Items
    ['OrderItem', 'RecipeItem', 'PurchaseItem', 'InventoryTransaction'],
    
    // Level 8: Ledgers & History
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
    OperationTiming: 'operationTimingModel',
    SchemaVersion: 'schemaVersionModel'
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
        const totalStartTime = Date.now();
        console.log(`[TenantModelLoader] 🚀 SCHEMA-FIRST INITIALIZATION: ${schemaName}`);

        // 1. Ensure models are initialized (Independent of schema)
        console.time('⏱️ [Timing] ModelFactory.createModels');
        const { ModelFactory } = require('./modelFactory');
        const allModels = await ModelFactory.createModels(sequelize);
        console.timeEnd('⏱️ [Timing] ModelFactory.createModels');

        // 2. CREATE SCHEMA
        console.time('⏱️ [Timing] Create schema');
        await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
        console.timeEnd('⏱️ [Timing] Create schema');

        // 3. VERIFY SCHEMA EXISTS
        const schemaCheck = await sequelize.query(`
            SELECT schema_name FROM information_schema.schemata WHERE schema_name = :schema
        `, { 
            replacements: { schema: schemaName }, 
            type: sequelize.QueryTypes.SELECT 
        });

        if (!schemaCheck || schemaCheck.length === 0) {
            throw new Error(`Schema ${schemaName} does not exist even after CREATE SCHEMA command.`);
        }
        console.log(`[TenantModelLoader] ✅ Schema verified: ${schemaName}`);

        // 4. SYNC MODELS SEQUENTIALLY (Schema-First Approach)
        // This ensures FK dependencies are created in the right order
        console.time('⏱️ [Timing] Sync all tables');
        console.log(`[TenantModelLoader] 🛠️  Syncing tables for schema: "${schemaName}"`);
        
        let syncedCount = 0;
        for (const level of MODEL_LOAD_ORDER) {
            console.log(`[TenantModelLoader]   - Level Sync Starting: ${level.join(', ')}`);
            const syncPromises = level.map(async (modelName) => {
                const model = allModels[modelName];
                if (!model) {
                    console.warn(`[TenantModelLoader]     [SKIP] Model ${modelName} not found in allModels registry`);
                    return;
                }
                
                try {
                    // Use model.schema(schemaName) to bind to the tenant schema
                    // force: false ensures we don't drop existing data if re-run
                    const schemaBoundModel = model.schema(schemaName);
                    await schemaBoundModel.sync({ force: false, alter: false });
                    syncedCount++;
                    // console.log(`[TenantModelLoader]     ✅ Synced: ${modelName}`);
                } catch (error) {
                    console.error(`[TenantModelLoader]     ❌ SYNC FAILED for ${modelName}:`, error.message);
                    throw new Error(`Sync failed for ${modelName}: ${error.message}`);
                }
            });
            await Promise.all(syncPromises);
            console.log(`[TenantModelLoader]   - Level Sync Complete`);
        }
        
        // 4b. Sync any remaining TENANT_MODELS that were not in MODEL_LOAD_ORDER
        const syncedModelNames = MODEL_LOAD_ORDER.flat();
        const remainingModels = TENANT_MODELS.filter(m => !syncedModelNames.includes(m));
        
        if (remainingModels.length > 0) {
            console.log(`[TenantModelLoader]   - Syncing Remaining models: ${remainingModels.join(', ')}`);
            const remainingPromises = remainingModels.map(async (modelName) => {
                const model = allModels[modelName];
                if (!model) return;
                try {
                    await model.schema(schemaName).sync({ force: false, alter: false });
                    syncedCount++;
                } catch (error) {
                    console.warn(`[TenantModelLoader]     ⚠️ SYNC FAILED for remaining model ${modelName} (might be expected dependency):`, error.message);
                }
            });
            await Promise.all(remainingPromises);
        }
        
        console.timeEnd('⏱️ [Timing] Sync all tables');
        console.log(`[TenantModelLoader] ✅ Total models synced: ${syncedCount}`);

        // 5. Initialize schema_versions table tracking
        console.time('⏱️ [Timing] Initialize schema_versions');
        
        const latestVersion = 12;
        const SchemaVersion = allModels.SchemaVersion;
        
        if (SchemaVersion) {
            console.log(`[TenantModelLoader] 🔢 Initializing version tracking at v${latestVersion} for ${schemaName}`);
            try {
                const schemaBoundSchemaVersion = SchemaVersion.schema(schemaName);
                await schemaBoundSchemaVersion.bulkCreate([
                    {
                        version: 0,
                        migrationName: 'init',
                        description: 'Initial version',
                        appliedBy: 'system',
                        appliedAt: new Date()
                    },
                    {
                        version: latestVersion,
                        migrationName: 'baseline',
                        description: 'Baseline schema-first init',
                        appliedBy: 'system',
                        appliedAt: new Date()
                    }
                ], { 
                    ignoreDuplicates: true,
                    returning: false
                });
            } catch (error) {
                console.warn(`[TenantModelLoader] ⚠️ Failed to insert schema versions:`, error.message);
                // Fallback to raw SQL if model fails (just in case of model issues)
                try {
                    await sequelize.query(`
                        INSERT INTO "${schemaName}"."schema_versions" 
                        (id, version, migration_name, description, applied_by, applied_at, created_at, updated_at) 
                        VALUES 
                            (gen_random_uuid(), 0, 'init', 'Initial version', 'system', NOW(), NOW(), NOW()),
                            (gen_random_uuid(), :latestVersion, 'baseline', 'Baseline schema-first init', 'system', NOW(), NOW(), NOW())
                        ON CONFLICT (version) DO NOTHING
                    `, { replacements: { latestVersion } });
                } catch (rawError) {
                    console.error(`[TenantModelLoader] 🚨 CRITICAL: Raw SQL version init failed:`, rawError.message);
                }
            }
        } else {
            console.warn('[TenantModelLoader] ⚠️ SchemaVersion model not found. Version tracking not initialized.');
        }
        
        console.timeEnd('⏱️ [Timing] Initialize schema_versions');
        
        // 6. RUN ANY REMAINING MIGRATIONS (beyond baseline)
        console.time('⏱️ [Timing] Run pending migrations');
        try {
            const tenantMigrationService = require('../../services/tenantMigrationService');
            // Extract businessId from schemaName (tenant_uuid)
            const businessId = schemaName.replace('tenant_', '');
            await tenantMigrationService.runPendingMigrations(businessId);
        } catch (error) {
            console.warn(`[TenantModelLoader] ⚠️ Potential issue running migrations after sync:`, error.message);
        }
        console.timeEnd('⏱️ [Timing] Run pending migrations');

        const duration = Date.now() - totalStartTime;
        console.log(`[TenantModelLoader] ✅ SCHEMA-FIRST INIT COMPLETE: ${schemaName} in ${duration}ms`);

        // Get list of tables that were created
        const tablesResult = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = :schema
            AND table_type = 'BASE TABLE'
        `, {
            replacements: { schema: schemaName },
            type: Sequelize.QueryTypes.SELECT
        });
        
        const createdTables = (tablesResult || []).map(t => t.table_name);

        // Bind models to the new schema for return
        const models = {};
        for (const modelName of TENANT_MODELS) {
            if (allModels[modelName]) {
                models[modelName] = allModels[modelName].schema(schemaName);
            }
        }

        return {
            schemaName,
            models,
            duration,
            created: createdTables
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

}

// Export singleton
const tenantModelLoader = new TenantModelLoader();

// 🔒 FREEZE: Lock the model cache to prevent modification
Object.freeze(tenantModelLoader.modelCache);

// Attach metadata for migrations
tenantModelLoader.MODEL_LOAD_ORDER = MODEL_LOAD_ORDER;

module.exports = tenantModelLoader;
