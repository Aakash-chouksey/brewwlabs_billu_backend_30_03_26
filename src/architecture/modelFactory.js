/**
 * CENTRALIZED MODEL FACTORY
 * 
 * Enforces strict model initialization patterns.
 * No direct model imports allowed anywhere else.
 */

const { Sequelize, DataTypes } = require('sequelize');
const { CONTROL_MODELS, TENANT_MODELS } = require('../utils/constants');

/**
 * Model Registry - Single source of truth for all models
 */
class ModelRegistry {
    constructor() {
        this.models = new Map();
        this.definitionsReady = false;
        this.associationsSetup = false;
    }

    /**
     * Register a model definition
     */
    registerModel(name, definition) {
        if (this.models.has(name)) {
            return; // Skip if already registered
        }
        this.models.set(name, definition);
    }

    /**
     * Get all registered models
     */
    getRegisteredModels() {
        return Array.from(this.models.keys());
    }

    /**
     * Create models for a given sequelize instance - PRODUCTION READY
     */
    static async createModels(sequelize) {
        if (!sequelize) {
            throw new Error('Sequelize instance is required for model creation');
        }

        const perfStart = Date.now();

        // 1. Check if and skip only if ALL registry models are present
        const registeredModelNames = modelRegistry.getRegisteredModels();
        const existingModelNames = Object.keys(sequelize.models);
        const allPresent = registeredModelNames.every(name => existingModelNames.includes(name));
        
        if (allPresent && existingModelNames.length > 0) {
            console.log(`[ModelRegistry] Skipping model creation - all ${registeredModelNames.length} models already initialized (${Date.now() - perfStart}ms)`);
            return sequelize.models;
        }

        console.log(`[ModelRegistry] Creating ${registeredModelNames.length} models (${existingModelNames.length} existing)...`);

        // 2. Ensure definitions are registered
        if (!modelRegistry.definitionsReady) {
            const setupStart = Date.now();
            this.setupModelDefinitions();
            console.log(`[ModelRegistry] Model definitions setup in ${Date.now() - setupStart}ms`);
        }

        const initializedModels = {};
        
        // 3. PHASE 1: Initialize all models (Define them on the connection)
        const phase1Start = Date.now();
        for (const modelName of modelRegistry.getRegisteredModels()) {
            try {
                // Skip if already on this connection
                if (sequelize.models[modelName]) {
                    initializedModels[modelName] = sequelize.models[modelName];
                    continue;
                }

                const modelFactory = modelRegistry.models.get(modelName);
                if (typeof modelFactory !== 'function') continue;

                const model = modelFactory(sequelize, DataTypes);
                if (!model) continue;

                initializedModels[modelName] = model;
            } catch (error) {
                console.error(`❌ Failed to initialize model ${modelName}:`, error.message);
                throw error;
            }
        }
        console.log(`[ModelRegistry] Phase 1 (model init) completed in ${Date.now() - phase1Start}ms`);

        // 4. PHASE 2: Setup Associations
        const phase2Start = Date.now();
        try {
            // Priority 1: Model-specific association logic
            for (const modelName in initializedModels) {
                const model = initializedModels[modelName];
                if (typeof model.associate === 'function') {
                    try {
                        model.associate(initializedModels);
                    } catch (error) {
                        // Association already defined, skip
                    }
                }
            }

            // Priority 2: Fallback to centralized association rules
            modelRegistry.setupAssociations(initializedModels);
        } catch (error) {
            console.warn('⚠️ Some associations were already defined or had conflicts:', error.message);
            // Non-critical: Continue if associations are already partially set up
        }
        console.log(`[ModelRegistry] Phase 2 (associations) completed in ${Date.now() - phase2Start}ms`);
        
        console.log(`[ModelRegistry] Total model creation time: ${Date.now() - perfStart}ms`);
        
        return initializedModels;
    }

    /**
     * Initialize all models with a Sequelize instance
     */
    async initializeModels(sequelize) {
        if (!sequelize) {
            throw new Error('Sequelize instance required for model initialization');
        }

        const initializedModels = {};

        // Initialize all registered models
        for (const [name, definition] of this.models) {
            try {
                const model = definition(sequelize, DataTypes);
                initializedModels[name] = model;
            } catch (error) {
                console.error(`❌ Failed to initialize model ${name}:`, error);
                throw error;
            }
        }

        // Setup associations
        this.setupAssociations(initializedModels);

        return initializedModels;
    }

    /**
     * Setup model associations
     */
    setupAssociations(models) {
        try {
            // Helper to check if association already exists
            const hasAssociation = (model, alias) => {
                return model.associations && model.associations[alias];
            };

            // Business & Outlet associations REMOVED (Cross-schema)
            // Outlet is tenant, Business is control.


            // Tenant Registry Association (Phase 1)
            if (models.Business && models.TenantRegistry) {
                if (!hasAssociation(models.Business, 'registry')) {
                    models.Business.hasOne(models.TenantRegistry, { foreignKey: 'business_id', as: 'registry' });
                }
                if (!hasAssociation(models.TenantRegistry, 'registryBusiness')) {
                    models.TenantRegistry.belongsTo(models.Business, { foreignKey: 'business_id', as: 'registryBusiness' });
                }
            }

            // User associations REMOVED (Cross-schema)
            // User is control, Business is control (Safe, but removing if requested to be UUID only)
            // Actually Business & User are BOTH control models, so they are in the same schema.
            // But the instruction says "REMOVE cross-schema relations. Replace with: business_id: DataTypes.UUID"
            // If Business and User are in same schema, they are NOT cross-schema.
            // I will keep associations between CONTROL_MODELS.
            if (models.User && models.Business) {
                if (!hasAssociation(models.User, 'userBusiness')) {
                    models.User.belongsTo(models.Business, { foreignKey: 'business_id', as: 'userBusiness' });
                }
            }

            // User-Outlet association is defined in outletModel.js associate function
            // DO NOT define here to prevent duplicate alias conflict

            // Product & Category
            if (models.Product) {
                if (models.Category) {
                    if (!hasAssociation(models.Product, 'category')) {
                        models.Product.belongsTo(models.Category, { foreignKey: 'category_id', as: 'category' });
                    }
                    if (!hasAssociation(models.Category, 'products')) {
                        models.Category.hasMany(models.Product, { foreignKey: 'category_id', as: 'products' });
                    }
                }
                if (models.Business) {
                    // REMOVED: Cross-schema association Product -> Business
                }
            }

            if (models.Category) {
                if (models.Business) {
                    // REMOVED: Cross-schema association Category -> Business
                }
                if (models.Outlet) {
                    if (!hasAssociation(models.Category, 'outlet')) {
                        models.Category.belongsTo(models.Outlet, { foreignKey: 'outlet_id', as: 'outlet' });
                    }
                    if (!hasAssociation(models.Outlet, 'categories')) {
                        models.Outlet.hasMany(models.Category, { foreignKey: 'outlet_id', as: 'categories' });
                    }
                }
            }

            // Order & OrderItem
            if (models.Order) {
                if (models.Business) {
                    // REMOVED: Cross-schema association Order -> Business
                }
                if (models.Outlet) {
                    if (!hasAssociation(models.Order, 'outlet')) {
                        models.Order.belongsTo(models.Outlet, { foreignKey: 'outlet_id', as: 'outlet' });
                    }
                    if (!hasAssociation(models.Outlet, 'orders')) {
                        models.Outlet.hasMany(models.Order, { foreignKey: 'outlet_id', as: 'orders' });
                    }
                }
                if (models.Table) {
                    if (!hasAssociation(models.Order, 'table')) {
                        models.Order.belongsTo(models.Table, { foreignKey: 'table_id', as: 'table' });
                    }
                    if (!hasAssociation(models.Table, 'orders')) {
                        models.Table.hasMany(models.Order, { foreignKey: 'table_id', as: 'orders' });
                    }
                }
            }

            if (models.OrderItem) {
                if (models.Order) {
                    if (!hasAssociation(models.OrderItem, 'order')) {
                        models.OrderItem.belongsTo(models.Order, { foreignKey: 'order_id', as: 'order' });
                    }
                    if (!hasAssociation(models.Order, 'items')) {
                        models.Order.hasMany(models.OrderItem, { foreignKey: 'order_id', as: 'items' });
                    }
                }
                if (models.Product) {
                    if (!hasAssociation(models.OrderItem, 'product')) {
                        models.OrderItem.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
                    }
                    if (!hasAssociation(models.Product, 'orderItems')) {
                        models.Product.hasMany(models.OrderItem, { foreignKey: 'product_id', as: 'orderItems' });
                    }
                }
                if (models.Business) {
                    // REMOVED: Cross-schema association OrderItem -> Business
                }
            }

            // Inventory System (Consolidated)
            if (models.InventoryItem) {
                if (models.InventoryCategory) {
                    if (!hasAssociation(models.InventoryItem, 'category')) {
                        models.InventoryItem.belongsTo(models.InventoryCategory, { foreignKey: 'inventory_category_id', as: 'category' });
                    }
                    if (!hasAssociation(models.InventoryCategory, 'items')) {
                        models.InventoryCategory.hasMany(models.InventoryItem, { foreignKey: 'inventory_category_id', as: 'items' });
                    }
                }
                if (models.Business) {
                    // Cross-schema: constraints: false

                }
                if (models.Outlet) {
                    if (!hasAssociation(models.InventoryItem, 'outlet')) {
                        models.InventoryItem.belongsTo(models.Outlet, { foreignKey: 'outlet_id', as: 'outlet' });
                    }
                }
                // Note: Supplier association is now defined in InventoryItem model itself
                // This prevents naming collisions and follows proper model architecture
            }

            if (models.InventoryTransaction) {
                if (models.InventoryItem) {
                    if (!hasAssociation(models.InventoryTransaction, 'inventoryItem')) {
                        models.InventoryTransaction.belongsTo(models.InventoryItem, { foreignKey: 'inventory_item_id', as: 'inventoryItem' });
                    }
                    if (!hasAssociation(models.InventoryItem, 'transactions')) {
                        models.InventoryItem.hasMany(models.InventoryTransaction, { foreignKey: 'inventory_item_id', as: 'transactions' });
                    }
                }
                if (models.Business) {
                    // REMOVED: Cross-schema association InventoryTransaction -> Business
                }
            }

            // Recipe System
            if (models.Recipe) {
                if (models.Product) {
                    if (!hasAssociation(models.Recipe, 'product')) {
                        models.Recipe.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
                    }
                }
                if (models.Business) {
                    // REMOVED: Cross-schema association Recipe -> Business
                }
                if (models.RecipeItem) {
                    if (!hasAssociation(models.Recipe, 'recipeItems')) {
                        models.Recipe.hasMany(models.RecipeItem, { foreignKey: 'recipe_id', as: 'recipeItems' });
                    }
                    if (!hasAssociation(models.RecipeItem, 'recipe')) {
                        models.RecipeItem.belongsTo(models.Recipe, { foreignKey: 'recipe_id', as: 'recipe' });
                    }
                }
            }

            if (models.RecipeItem && models.InventoryItem) {
                if (!hasAssociation(models.RecipeItem, 'inventoryItem')) {
                    models.RecipeItem.belongsTo(models.InventoryItem, { foreignKey: 'inventory_item_id', as: 'inventoryItem' });
                }
            }

            // Customer Management
            if (models.Customer) {
                if (models.Business) {
                    // REMOVED: Cross-schema association Customer -> Business
                }
                if (models.Order) {
                    if (!hasAssociation(models.Customer, 'orders')) {
                        models.Customer.hasMany(models.Order, { foreignKey: 'customer_id', as: 'orders' });
                    }
                    if (!hasAssociation(models.Order, 'customer')) {
                        models.Order.belongsTo(models.Customer, { foreignKey: 'customer_id', as: 'customer' });
                    }
                }
            }

            // Purchase & Supplier System
            if (models.Purchase) {
                if (models.Supplier) {
                    if (!hasAssociation(models.Purchase, 'supplier')) {
                        models.Purchase.belongsTo(models.Supplier, { foreignKey: 'supplier_id', as: 'supplier' });
                    }
                    if (!hasAssociation(models.Supplier, 'purchases')) {
                        models.Supplier.hasMany(models.Purchase, { foreignKey: 'supplier_id', as: 'purchases' });
                    }
                }
                if (models.Business) {
                    // REMOVED: Cross-schema association Purchase -> Business
                }
                if (models.Outlet) {
                    if (!hasAssociation(models.Purchase, 'outlet')) {
                        models.Purchase.belongsTo(models.Outlet, { foreignKey: 'outlet_id', as: 'outlet' });
                    }
                }
                if (models.PurchaseItem) {
                    if (!hasAssociation(models.Purchase, 'purchaseItems')) {
                        models.Purchase.hasMany(models.PurchaseItem, { foreignKey: 'purchase_id', as: 'purchaseItems' });
                    }
                    if (!hasAssociation(models.PurchaseItem, 'purchase')) {
                        models.PurchaseItem.belongsTo(models.Purchase, { foreignKey: 'purchase_id', as: 'purchase' });
                    }
                }
            }

            if (models.PurchaseItem && models.Product) {
                if (!hasAssociation(models.PurchaseItem, 'product')) {
                    models.PurchaseItem.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
                }
            }

            // Tables & Areas
            if (models.Table) {
                if (models.Area) {
                    if (!hasAssociation(models.Table, 'area')) {
                        models.Table.belongsTo(models.Area, { foreignKey: 'area_id', as: 'area' });
                    }
                    if (!hasAssociation(models.Area, 'tables')) {
                        models.Area.hasMany(models.Table, { foreignKey: 'area_id', as: 'tables' });
                    }
                }
                if (models.Outlet) {
                    if (!hasAssociation(models.Table, 'outlet')) {
                        models.Table.belongsTo(models.Outlet, { foreignKey: 'outlet_id', as: 'outlet' });
                    }
                }
                if (models.Business) {
                    // REMOVED: Cross-schema association Table -> Business
                }
            }

            if (models.Area) {
                if (models.Outlet) {
                    if (!hasAssociation(models.Area, 'outlet')) {
                        models.Area.belongsTo(models.Outlet, { foreignKey: 'outlet_id', as: 'outlet' });
                    }
                }
                if (models.Business) {
                    // REMOVED: Cross-schema association Area -> Business
                }
            }
        } catch (error) {
            console.error('❌ Failed to setup associations:', error);
            throw error;
        }
    }
}

// Global model registry instance
const modelRegistry = new ModelRegistry();

/**
 * Model Factory - Creates and manages models
 */
class ModelFactory {
    /**
     * Setup all model definitions
     */
    static setupModelDefinitions() {
        // 1. Load CONTROL_MODELS from control_plane_models directory
        const controlMapping = {
            'User': 'userModel',
            'Business': 'businessModel',
            'TenantRegistry': 'tenantRegistryModel',
            'ClusterMetadata': 'clusterMetadataModel',
            'Plan': 'planModel',
            'Subscription': 'subscriptionModel',
            'SuperAdminUser': 'superAdminModel',
            'TenantConnection': 'tenantConnectionModel',
            'TenantMigrationLog': 'tenantMigrationLogModel',
            'SystemMetrics': 'systemMetricsModel',
            'AuditLog': 'auditLogModel',
            'Auth': null // Skip if no physical model file
        };

        for (const modelName of CONTROL_MODELS) {
            const fileName = controlMapping[modelName];
            if (!fileName) continue;

            try {
                const modelDefinition = require(`../../control_plane_models/${fileName}`);
                // Platform AuditLog export is an object: { AuditLog, AuditService }
                const factory = typeof modelDefinition === 'function' ? modelDefinition : (modelDefinition.AuditLog || modelDefinition.default);
                
                if (typeof factory === 'function') {
                    modelRegistry.registerModel(modelName, factory);
                }
            } catch (error) {
                console.error(`❌ Failed to load CONTROL model ${modelName}:`, error.message);
                throw error;
            }
        }

        // 2. Load TENANT_MODELS from models directory
        for (const modelName of TENANT_MODELS) {
            // Mapping for special cases
            let fileName;
            if (modelName === 'TenantAuditLog') {
                fileName = 'tenantAuditLogModel';
            } else {
                fileName = modelName.charAt(0).toLowerCase() + modelName.slice(1) + 'Model';
            }

            try {
                const modelDefinition = require(`../../models/${fileName}`);
                const factory = typeof modelDefinition === 'function' ? modelDefinition : modelDefinition.default;
                
                if (typeof factory === 'function') {
                    modelRegistry.registerModel(modelName, factory);
                }
            } catch (error) {
                // Some models might be optional or registered elsewhere
                console.warn(`⚠️ TENANT model ${modelName} not found in models directory`);
            }
        }

        // 3. FINAL VERIFICATION: Check registered counts
        const registered = modelRegistry.getRegisteredModels();
        // console.log(`✅ Registered ${registered.length} models (${CONTROL_MODELS.length} Control, ${TENANT_MODELS.length} Tenant)`);

        // 4. VERIFY NO OVERLAP
        const controlInTenant = CONTROL_MODELS.filter(m => TENANT_MODELS.includes(m));
        if (controlInTenant.length > 0) {
            throw new Error(`🚨 ARCHITECTURAL VIOLATION: Models registered in both Control and Tenant: ${controlInTenant.join(', ')}`);
        }

        modelRegistry.definitionsReady = true;
    }

    /**
     * Create models for a specific Sequelize instance
     */
    static async createModels(sequelize) {
        if (!modelRegistry.definitionsReady) {
            this.setupModelDefinitions();
        }

        // Use the static ModelRegistry.createModels which handles associations
        return await ModelRegistry.createModels(sequelize);
    }

    /**
     * Validate models are properly initialized
     */
    static validateModels(models) {
        const requiredModels = [
            'User', 'Business', 'Product', 'Category', 'Order', 'OrderItem',
            'Customer', 'CustomerTransaction', 'CustomerLedger', 'TenantRegistry'
        ];

        const missingModels = requiredModels.filter(name => !models[name]);
        
        if (missingModels.length > 0) {
            throw new Error(`Missing required models: ${missingModels.join(', ')}`);
        }

        return true;
    }
}

// No automatic init at bottom to prevent race conditions during module loading
// ModelFactory.setupModelDefinitions();

module.exports = {
    ModelFactory,
    modelRegistry
};
