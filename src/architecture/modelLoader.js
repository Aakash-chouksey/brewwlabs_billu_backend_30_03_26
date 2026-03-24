const { Sequelize, DataTypes } = require('sequelize');

/**
 * STRICTLY SEPARATED MODEL LOADERS
 * 
 * CRITICAL RULE: Control plane models and tenant models MUST NEVER overlap.
 */

// Control Plane Models - These belong ONLY in the public schema
const CONTROL_PLANE_MODEL_NAMES = [
  'Business',
  'User', 
  'TenantRegistry',
  'AuditLog',
  'SystemMetrics',
  'TenantConnection',
  'Subscription',
  'Plan',
  'SuperAdminUser',
  'ClusterMetadata',
  'TenantMigrationLog'
];

// Tenant Models - These belong ONLY in tenant schemas
const TENANT_MODEL_NAMES = [
  'Outlet', 'Category', 'ProductType', 'Product', 'Table', 'Area', 'Order', 'OrderItem',
  'Customer', 'CustomerTransaction', 'CustomerLedger', 'InventoryItem', 'InventoryCategory',
  'InventoryTransaction', 'Recipe', 'RecipeItem', 'Supplier', 'Purchase', 'PurchaseItem',
  'Account', 'Transaction', 'Expense', 'ExpenseType', 'Income', 'Payment', 'Timing',
  'Setting', 'BillingConfig', 'MembershipPlan', 'PartnerType', 'PartnerMembership',
  'PartnerWallet', 'RollTracking', 'FeatureFlag', 'WebContent', 'StockTransaction',
  'Wastage', 'InventorySale', 'Subscription', 'OperationTiming'
];

/**
 * STRICT DETERMINISTIC SYNC ORDER
 */
const TENANT_MODEL_SYNC_ORDER = [
  'Category', 'Outlet', 'MembershipPlan', 'PartnerType',
  'Area', 'Table', 'ProductType', 'Account', 'ExpenseType',
  'Product', 'Customer', 'Supplier', 'PartnerMembership',
  'InventoryCategory', 'InventoryItem', 'Recipe', 'RecipeItem',
  'Order', 'OrderItem', 'Transaction', 'Payment', 'Expense', 'Income',
  'CustomerTransaction', 'CustomerLedger', 'InventoryTransaction',
  'Purchase', 'PurchaseItem', 'StockTransaction', 'Wastage', 'InventorySale',
  'Timing', 'Setting', 'BillingConfig', 'PartnerWallet', 'RollTracking',
  'FeatureFlag', 'WebContent', 'Subscription', 'OperationTiming'
];

const MODEL_FILE_MAP = {
  'Business': 'businessModel', 'User': 'userModel', 'TenantRegistry': 'tenantRegistryModel',
  'AuditLog': 'auditLogModel', 'SystemMetrics': 'systemMetricsModel', 'TenantConnection': 'tenantConnectionModel',
  'Subscription': 'subscriptionModel', 'Plan': 'planModel', 'SuperAdminUser': 'superAdminModel',
  'ClusterMetadata': 'clusterMetadataModel', 'TenantMigrationLog': 'tenantMigrationLogModel',
  'Outlet': 'outletModel', 'Category': 'categoryModel', 'ProductType': 'productTypeModel',
  'Product': 'productModel', 'Table': 'tableModel', 'Area': 'areaModel', 'Order': 'orderModel',
  'OrderItem': 'orderItemModel', 'Customer': 'customerModel', 'CustomerTransaction': 'customerTransactionModel',
  'CustomerLedger': 'customerLedgerModel', 'InventoryItem': 'inventoryItemModel',
  'InventoryCategory': 'inventoryCategoryModel', 'InventoryTransaction': 'inventoryTransactionModel',
  'Recipe': 'recipeModel', 'RecipeItem': 'recipeItemModel', 'Supplier': 'supplierModel',
  'Purchase': 'purchaseModel', 'PurchaseItem': 'purchaseItemModel', 'Account': 'accountModel',
  'Transaction': 'transactionModel', 'Expense': 'expenseModel', 'ExpenseType': 'expenseTypeModel',
  'Income': 'incomeModel', 'Payment': 'paymentModel', 'Timing': 'timingModel',
  'Setting': 'settingModel', 'BillingConfig': 'billingConfigModel', 'MembershipPlan': 'membershipPlanModel',
  'PartnerType': 'partnerTypeModel', 'PartnerMembership': 'partnerMembershipModel',
  'PartnerWallet': 'partnerWalletModel', 'RollTracking': 'rollTrackingModel',
  'FeatureFlag': 'featureFlagModel', 'WebContent': 'webContentModel',
  'StockTransaction': 'stockTransactionModel', 'Wastage': 'wastageModel',
  'InventorySale': 'inventorySaleModel', 'OperationTiming': 'operationTimingModel'
};

const initControlPlaneModels = async (sequelize) => {
  const models = {};
  for (const name of CONTROL_PLANE_MODEL_NAMES) {
    const file = MODEL_FILE_MAP[name];
    if (!file) continue;
    try {
      const def = require(`../../models/${file}`);
      if (typeof def === 'function') models[name] = def(sequelize, DataTypes);
    } catch (e) {
      console.warn(`⚠️ Error loading CP model ${name}: ${e.message}`);
    }
  }
  return models;
};

const initTenantModels = async (sequelize) => {
  const models = {};
  for (const name of TENANT_MODEL_NAMES) {
    const file = MODEL_FILE_MAP[name];
    if (!file) continue;
    try {
      const def = require(`../../models/${file}`);
      if (typeof def === 'function') models[name] = def(sequelize, DataTypes);
    } catch (e) {
      console.warn(`⚠️ Error loading tenant model ${name}: ${e.message}`);
    }
  }
  return models;
};

const validateNoControlPlaneModels = (models, context = 'tenant') => {
  const forbidden = ['Business', 'User', 'TenantRegistry', 'AuditLog', 'SystemMetrics'];
  for (const name of forbidden) {
    if (models[name]) throw new Error(`❌ CRITICAL: CP model "${name}" in ${context} context.`);
  }
  return true;
};

/**
 * Synchronize tenant models with deterministic order - FAIL FAST VERSION
 * Stops immediately if any model fails to sync
 */
const syncTenantModels = async (sequelize, schemaName, transaction = null) => {
  const models = await initTenantModels(sequelize);
  validateNoControlPlaneModels(models, `schema ${schemaName}`);

  console.log(`📊 Synchronizing ${TENANT_MODEL_SYNC_ORDER.length} models to [${schemaName}] (parallel chunks)...`);

  const schemaBoundModels = {};
  const syncStartTime = Date.now();
  const PARALLEL_CHUNK_SIZE = 50; // Sync all models in parallel for maximum speed on Neon
  
  // Process models in parallel chunks to avoid connection pinning
  for (let i = 0; i < TENANT_MODEL_SYNC_ORDER.length; i += PARALLEL_CHUNK_SIZE) {
    const chunk = TENANT_MODEL_SYNC_ORDER.slice(i, i + PARALLEL_CHUNK_SIZE);
    const chunkNumber = Math.floor(i / PARALLEL_CHUNK_SIZE) + 1;
    const totalChunks = Math.ceil(TENANT_MODEL_SYNC_ORDER.length / PARALLEL_CHUNK_SIZE);
    
    console.log(`   ⏳ Chunk ${chunkNumber}/${totalChunks}: Syncing [${chunk.join(', ')}]...`);
    const chunkStartTime = Date.now();
    
    // Execute all models in chunk in parallel
    const chunkPromises = chunk.map(async (name) => {
      const model = models[name];
      if (!model) {
        throw new Error(`🚨 Model sync failed: ${name} not found`);
      }
      
      try {
        const boundModel = model.schema(schemaName);
        // CRITICAL: Do NOT pass transaction for model sync
        // Transaction causes Neon connection pinning during long DDL operations
        await boundModel.sync({ force: false, alter: false });
        return { name, success: true, model: boundModel };
      } catch (error) {
        console.error(`   ❌ Sync failed at ${name}: ${error.message}`);
        throw new Error(`Model sync failed at ${name}: ${error.message}`);
      }
    });
    
    // Wait for entire chunk to complete
    const chunkResults = await Promise.all(chunkPromises);
    
    // Store successful syncs
    chunkResults.forEach(result => {
      schemaBoundModels[result.name] = result.model;
    });
    
    const chunkDuration = Date.now() - chunkStartTime;
    console.log(`   ✅ Chunk ${chunkNumber} synced in ${chunkDuration}ms`);
  }

  const syncDuration = Date.now() - syncStartTime;
  console.log(`✅ All ${Object.keys(schemaBoundModels).length} models synchronized to [${schemaName}] in ${syncDuration}ms`);

  return { syncedModels: Object.keys(schemaBoundModels), models: schemaBoundModels, duration: syncDuration };
};

module.exports = {
  initControlPlaneModels,
  initTenantModels,
  validateNoControlPlaneModels,
  syncTenantModels,
  CONTROL_PLANE_MODEL_NAMES,
  TENANT_MODEL_NAMES
};
