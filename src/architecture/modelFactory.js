/**
 * CENTRALIZED MODEL FACTORY
 * 
 * Enforces strict model initialization patterns.
 * No direct model imports allowed anywhere else.
 */

const { Sequelize, DataTypes } = require('sequelize');

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

        // 1. Check if models are already initialized on this connection
        if (sequelize.models && Object.keys(sequelize.models).length > 0) {
            return sequelize.models;
        }

        // 2. Ensure definitions are registered
        if (!modelRegistry.definitionsReady) {
            this.setupModelDefinitions();
        }

        const initializedModels = {};
        
        // 3. PHASE 1: Initialize all models (Define them on the connection)
        for (const modelName of modelRegistry.getRegisteredModels()) {
            try {
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

        // 4. PHASE 2: Setup Associations
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
            // Business & Outlet associations (Core) - Phase 3: Logical FK only
            if (models.Business && models.Outlet) {
                models.Outlet.belongsTo(models.Business, { foreignKey: 'business_id', as: 'outletBusiness', constraints: false });
                models.Business.hasMany(models.Outlet, { foreignKey: 'business_id', as: 'outlets', constraints: false });
            }

            // Tenant Registry Association (Phase 1)
            if (models.Business && models.TenantRegistry) {
                models.Business.hasOne(models.TenantRegistry, { foreignKey: 'business_id', as: 'registry' });
                models.TenantRegistry.belongsTo(models.Business, { foreignKey: 'business_id', as: 'registryBusiness' });
            }

            // User associations - Phase 3: Logical FK only
            if (models.User && models.Business) {
                models.User.belongsTo(models.Business, { foreignKey: 'business_id', as: 'userBusiness', constraints: false });
                models.Business.hasMany(models.User, { foreignKey: 'business_id', as: 'users', constraints: false });
            }

            // User-Outlet association is defined in outletModel.js associate function
            // DO NOT define here to prevent duplicate alias conflict

            // Product & Category
            if (models.Product) {
                if (models.Category) {
                    models.Product.belongsTo(models.Category, { foreignKey: 'category_id', as: 'category' });
                    models.Category.hasMany(models.Product, { foreignKey: 'category_id', as: 'products' });
                }
                if (models.Business) {
                    // Cross-schema: constraints: false
                    models.Product.belongsTo(models.Business, { foreignKey: 'business_id', as: 'productBusiness', constraints: false });
                    models.Business.hasMany(models.Product, { foreignKey: 'business_id', as: 'products', constraints: false });
                }
            }

            if (models.Category) {
                if (models.Business) {
                    // Cross-schema: constraints: false
                    models.Category.belongsTo(models.Business, { foreignKey: 'business_id', as: 'categoryBusiness', constraints: false });
                    models.Business.hasMany(models.Category, { foreignKey: 'business_id', as: 'categories', constraints: false });
                }
                if (models.Outlet) {
                    models.Category.belongsTo(models.Outlet, { foreignKey: 'outlet_id', as: 'outlet' });
                    models.Outlet.hasMany(models.Category, { foreignKey: 'outlet_id', as: 'categories' });
                }
            }

            // Order & OrderItem
            if (models.Order) {
                if (models.Business) {
                    // Cross-schema: constraints: false
                    models.Order.belongsTo(models.Business, { foreignKey: 'business_id', as: 'orderBusiness', constraints: false });
                    models.Business.hasMany(models.Order, { foreignKey: 'business_id', as: 'orders', constraints: false });
                }
                if (models.Outlet) {
                    models.Order.belongsTo(models.Outlet, { foreignKey: 'outlet_id', as: 'outlet' });
                    models.Outlet.hasMany(models.Order, { foreignKey: 'outlet_id', as: 'orders' });
                }
                if (models.Table) {
                    models.Order.belongsTo(models.Table, { foreignKey: 'table_id', as: 'table' });
                    models.Table.hasMany(models.Order, { foreignKey: 'table_id', as: 'orders' });
                }
            }

            if (models.OrderItem) {
                if (models.Order) {
                    models.OrderItem.belongsTo(models.Order, { foreignKey: 'order_id', as: 'order' });
                    models.Order.hasMany(models.OrderItem, { foreignKey: 'order_id', as: 'items' });
                }
                if (models.Product) {
                    models.OrderItem.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
                    models.Product.hasMany(models.OrderItem, { foreignKey: 'product_id', as: 'orderItems' });
                }
                if (models.Business) {
                    // Cross-schema: constraints: false
                    models.OrderItem.belongsTo(models.Business, { foreignKey: 'business_id', as: 'orderItemBusiness', constraints: false });
                }
            }

            // Inventory System (Consolidated)
            if (models.InventoryItem) {
                if (models.InventoryCategory) {
                    models.InventoryItem.belongsTo(models.InventoryCategory, { foreignKey: 'inventory_category_id', as: 'categoryData' });
                    models.InventoryCategory.hasMany(models.InventoryItem, { foreignKey: 'inventory_category_id', as: 'items' });
                }
                if (models.Business) {
                    // Cross-schema: constraints: false
                    models.InventoryItem.belongsTo(models.Business, { foreignKey: 'business_id', as: 'inventoryItemBusiness', constraints: false });
                }
                if (models.Outlet) {
                    models.InventoryItem.belongsTo(models.Outlet, { foreignKey: 'outlet_id', as: 'outlet' });
                }
                // Note: Supplier association is now defined in InventoryItem model itself
                // This prevents naming collisions and follows proper model architecture
            }

            if (models.InventoryTransaction) {
                if (models.InventoryItem) {
                    models.InventoryTransaction.belongsTo(models.InventoryItem, { foreignKey: 'inventory_item_id', as: 'inventoryItem' });
                    models.InventoryItem.hasMany(models.InventoryTransaction, { foreignKey: 'inventory_item_id', as: 'transactions' });
                }
                if (models.Business) {
                    // Cross-schema: constraints: false
                    models.InventoryTransaction.belongsTo(models.Business, { foreignKey: 'business_id', as: 'inventoryTransactionBusiness', constraints: false });
                }
            }

            // Recipe System
            if (models.Recipe) {
                if (models.Product) {
                    models.Recipe.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
                }
                if (models.Business) {
                    // Cross-schema: constraints: false
                    models.Recipe.belongsTo(models.Business, { foreignKey: 'business_id', as: 'recipeBusiness', constraints: false });
                }
                if (models.RecipeItem) {
                    models.Recipe.hasMany(models.RecipeItem, { foreignKey: 'recipe_id', as: 'recipeItems' });
                    models.RecipeItem.belongsTo(models.Recipe, { foreignKey: 'recipe_id', as: 'recipe' });
                }
            }

            if (models.RecipeItem && models.InventoryItem) {
                models.RecipeItem.belongsTo(models.InventoryItem, { foreignKey: 'inventory_item_id', as: 'inventoryItem' });
            }

            // Customer Management
            if (models.Customer) {
                if (models.Business) {
                    // Cross-schema: constraints: false
                    models.Customer.belongsTo(models.Business, { foreignKey: 'business_id', as: 'customerBusiness', constraints: false });
                    models.Business.hasMany(models.Customer, { foreignKey: 'business_id', as: 'customers', constraints: false });
                }
                if (models.Order) {
                    models.Customer.hasMany(models.Order, { foreignKey: 'customer_id', as: 'orders' });
                    models.Order.belongsTo(models.Customer, { foreignKey: 'customer_id', as: 'customer' });
                }
            }

            // Purchase & Supplier System
            if (models.Purchase) {
                if (models.Supplier) {
                    models.Purchase.belongsTo(models.Supplier, { foreignKey: 'supplier_id', as: 'supplier' });
                    models.Supplier.hasMany(models.Purchase, { foreignKey: 'supplier_id', as: 'purchases' });
                }
                if (models.Business) {
                    // Cross-schema: constraints: false
                    models.Purchase.belongsTo(models.Business, { foreignKey: 'business_id', as: 'purchaseBusiness', constraints: false });
                }
                if (models.Outlet) {
                    models.Purchase.belongsTo(models.Outlet, { foreignKey: 'outlet_id', as: 'outlet' });
                }
                if (models.PurchaseItem) {
                    models.Purchase.hasMany(models.PurchaseItem, { foreignKey: 'purchase_id', as: 'purchaseItems' });
                    models.PurchaseItem.belongsTo(models.Purchase, { foreignKey: 'purchase_id', as: 'purchase' });
                }
            }

            if (models.PurchaseItem && models.Product) {
                models.PurchaseItem.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
            }

            // Tables & Areas
            if (models.Table) {
                if (models.Area) {
                    models.Table.belongsTo(models.Area, { foreignKey: 'area_id', as: 'area' });
                    models.Area.hasMany(models.Table, { foreignKey: 'area_id', as: 'tables' });
                }
                if (models.Outlet) {
                    models.Table.belongsTo(models.Outlet, { foreignKey: 'outlet_id', as: 'outlet' });
                }
                if (models.Business) {
                    models.Table.belongsTo(models.Business, { foreignKey: 'business_id', as: 'tableBusiness', constraints: false });
                }
            }

            if (models.Area) {
                if (models.Outlet) {
                    models.Area.belongsTo(models.Outlet, { foreignKey: 'outlet_id', as: 'outlet' });
                }
                if (models.Business) {
                    models.Area.belongsTo(models.Business, { foreignKey: 'business_id', as: 'areaBusiness', constraints: false });
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
        // Import and register all model definitions
        const modelFiles = [
            'userModel',
            'businessModel', 
            'productModel',
            'categoryModel',
            'orderModel',
            'orderItemModel',
            'inventoryModel',
            'inventoryItemModel',
            'inventoryTransactionModel',
            'accountModel',
            'transactionModel',
            'outletModel',
            'areaModel',
            'tableModel',
            'recipeModel',
            'recipeItemModel',
            'supplierModel',
            'purchaseModel',
            'purchaseItemModel',
            'expenseModel',
            'expenseTypeModel',
            'incomeModel',
            'paymentModel',
            'timingModel',
            'settingModel',
            'billingConfigModel',
            'membershipPlanModel',
            'partnerTypeModel',
            'partnerMembershipModel',
            'partnerWalletModel',
            'rollTrackingModel',
            'featureFlagModel',
            'webContentModel',
            'productTypeModel',
            'inventoryCategoryModel',
            'auditLogModel',
            'customerModel',
            'customerTransactionModel',
            'customerLedgerModel',
            'tenantRegistryModel'
        ];

        for (const modelFile of modelFiles) {
            try {
                const modelDefinition = require(`../../models/${modelFile}`);
                const modelName = modelFile.replace('Model', '').replace(/^[a-z]/, char => char.toUpperCase());
                
                if (typeof modelDefinition === 'function') {
                    modelRegistry.registerModel(modelName, modelDefinition);
                } else if (modelDefinition.default && typeof modelDefinition.default === 'function') {
                    modelRegistry.registerModel(modelName, modelDefinition.default);
                }
            } catch (error) {
                // Silent fail for optional models
            }
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
