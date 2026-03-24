const { Sequelize, DataTypes } = require('sequelize');

/**
 * Schema-Aware Model Factory
 * 
 * Creates models that work with schema-per-tenant architecture
 * Uses single Sequelize instance with dynamic schema switching
 */

// Cache for model definitions to avoid re-initialization
const modelCache = new Map();

/**
 * Initialize all models for schema-per-tenant architecture
 * Models are schema-agnostic and work with whatever schema is currently active
 */
const initModels = async (sequelize) => {
  const cacheKey = 'schema_models';
  
  // Return cached models if available
  if (modelCache.has(cacheKey)) {
    console.log('✅ Using cached schema models');
    return modelCache.get(cacheKey);
  }

  console.log('🏗️ Initializing schema-aware models...');

  // Define all models
  const models = {};

  // User Model
  models.User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'first_name'
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'last_name'
    },
    role: {
      type: DataTypes.ENUM('SUPER_ADMIN', 'BUSINESS_ADMIN', 'OUTLET_ADMIN', 'MANAGER', 'STAFF'),
      defaultValue: 'STAFF'
    },
    brandId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'brand_id'
    },
    outletId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'outlet_id'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_login_at'
    }
  }, {
    tableName: 'users',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['email'] },
      { fields: ['brand_id'] },
      { fields: ['outlet_id'] },
      { fields: ['role'] }
    ]
  });

  // Business Model
  models.Business = sequelize.define('Business', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    logo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    website: {
      type: DataTypes.STRING,
      allowNull: true
    },
    taxId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'tax_id'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    settings: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'businesses',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['email'] },
      { fields: ['is_active'] }
    ]
  });

  // Outlet Model
  models.Outlet = sequelize.define('Outlet', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    brandId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'brand_id'
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'maintenance'),
      defaultValue: 'active'
    },
    settings: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    businessHours: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'outlets',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['brand_id'] },
      { fields: ['is_active'] },
      { fields: ['status'] }
    ]
  });

  // Category Model
  models.Category = sequelize.define('Category', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    brandId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'brand_id'
    },
    parentId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'parent_id'
    },
    imageUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'image_url'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'display_order'
    }
  }, {
    tableName: 'categories',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['brand_id'] },
      { fields: ['parent_id'] },
      { fields: ['is_active'] },
      { fields: ['display_order'] }
    ]
  });

  // Product Type Model
  models.ProductType = sequelize.define('ProductType', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    brandId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'brand_id'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    }
  }, {
    tableName: 'product_types',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['brand_id'] },
      { fields: ['is_active'] }
    ]
  });

  // Product Model
  models.Product = sequelize.define('Product', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    },
    barcode: {
      type: DataTypes.STRING,
      allowNull: true
    },
    brandId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'brand_id'
    },
    categoryId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'category_id'
    },
    productTypeId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'product_type_id'
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    costPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'cost_price'
    },
    imageUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'image_url'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    trackInventory: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'track_inventory'
    },
    currentStock: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'current_stock'
    },
    minStockLevel: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'min_stock_level'
    },
    maxStockLevel: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'max_stock_level'
    },
    unit: {
      type: DataTypes.STRING,
      defaultValue: 'pcs'
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    attributes: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'products',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['brand_id'] },
      { fields: ['category_id'] },
      { fields: ['product_type_id'] },
      { fields: ['sku'] },
      { fields: ['barcode'] },
      { fields: ['is_active'] },
      { fields: ['track_inventory'] }
    ]
  });

  // Table Model
  models.Table = sequelize.define('Table', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    number: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    capacity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 4
    },
    brandId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'brand_id'
    },
    outletId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'outlet_id'
    },
    status: {
      type: DataTypes.ENUM('available', 'occupied', 'reserved', 'cleaning', 'maintenance'),
      defaultValue: 'available'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true
    },
    qrCode: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'qr_code'
    }
  }, {
    tableName: 'tables',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['brand_id'] },
      { fields: ['outlet_id'] },
      { fields: ['number'] },
      { fields: ['status'] },
      { fields: ['is_active'] }
    ]
  });

  // Order Model
  models.Order = sequelize.define('Order', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    orderNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: 'order_number'
    },
    brandId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'brand_id'
    },
    outletId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'outlet_id'
    },
    tableId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'table_id'
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'customer_id'
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id'
    },
    status: {
      type: DataTypes.ENUM('pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled'),
      defaultValue: 'pending'
    },
    orderType: {
      type: DataTypes.ENUM('dine_in', 'takeaway', 'delivery'),
      defaultValue: 'dine_in',
      field: 'order_type'
    },
    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    taxAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'tax_amount'
    },
    discountAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'discount_amount'
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'total_amount'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    orderDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'order_date'
    },
    orderTime: {
      type: DataTypes.TIME,
      allowNull: false,
      field: 'order_time'
    }
  }, {
    tableName: 'orders',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['order_number'] },
      { fields: ['brand_id'] },
      { fields: ['outlet_id'] },
      { fields: ['table_id'] },
      { fields: ['customer_id'] },
      { fields: ['user_id'] },
      { fields: ['status'] },
      { fields: ['order_type'] },
      { fields: ['order_date'] }
    ]
  });

  // Order Item Model
  models.OrderItem = sequelize.define('OrderItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'order_id'
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'product_id'
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    unitPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'unit_price'
    },
    totalPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'total_price'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled'),
      defaultValue: 'pending'
    }
  }, {
    tableName: 'order_items',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['order_id'] },
      { fields: ['product_id'] },
      { fields: ['status'] }
    ]
  });

  // Define Associations
  Object.keys(models).forEach(modelName => {
    if (models[modelName].associate) {
      models[modelName].associate(models);
    }
  });

  // Setup model associations
  setupAssociations(models);

  // Cache the models
  modelCache.set(cacheKey, models);
  
  console.log(`✅ Schema-aware models initialized: ${Object.keys(models).length} models`);
  return models;
};

/**
 * Setup model associations
 */
const setupAssociations = (models) => {
  const { User, Business, Outlet, Category, ProductType, Product, Table, Order, OrderItem } = models;

  // User associations
  User.belongsTo(Business, { foreignKey: 'brandId', as: 'business' });
  User.belongsTo(Outlet, { foreignKey: 'outletId', as: 'outlet' });
  User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });

  // Business associations
  Business.hasMany(User, { foreignKey: 'brandId', as: 'users' });
  Business.hasMany(Outlet, { foreignKey: 'brandId', as: 'outlets' });
  Business.hasMany(Category, { foreignKey: 'brandId', as: 'categories' });
  Business.hasMany(ProductType, { foreignKey: 'brandId', as: 'productTypes' });
  Business.hasMany(Product, { foreignKey: 'brandId', as: 'products' });
  Business.hasMany(Table, { foreignKey: 'brandId', as: 'tables' });
  Business.hasMany(Order, { foreignKey: 'brandId', as: 'orders' });

  // Outlet associations
  Outlet.belongsTo(Business, { foreignKey: 'brandId', as: 'business' });
  Outlet.hasMany(User, { foreignKey: 'outletId', as: 'users' });
  Outlet.hasMany(Table, { foreignKey: 'outletId', as: 'tables' });
  Outlet.hasMany(Order, { foreignKey: 'outletId', as: 'orders' });

  // Category associations
  Category.belongsTo(Business, { foreignKey: 'brandId', as: 'business' });
  Category.belongsTo(Category, { foreignKey: 'parentId', as: 'parent' });
  Category.hasMany(Category, { foreignKey: 'parentId', as: 'children' });
  Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });

  // ProductType associations
  ProductType.belongsTo(Business, { foreignKey: 'brandId', as: 'business' });
  ProductType.hasMany(Product, { foreignKey: 'productTypeId', as: 'products' });

  // Product associations
  Product.belongsTo(Business, { foreignKey: 'brandId', as: 'business' });
  Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
  Product.belongsTo(ProductType, { foreignKey: 'productTypeId', as: 'productType' });
  Product.hasMany(OrderItem, { foreignKey: 'productId', as: 'orderItems' });

  // Table associations
  Table.belongsTo(Business, { foreignKey: 'brandId', as: 'business' });
  Table.belongsTo(Outlet, { foreignKey: 'outletId', as: 'outlet' });
  Table.hasMany(Order, { foreignKey: 'tableId', as: 'orders' });

  // Order associations
  Order.belongsTo(Business, { foreignKey: 'brandId', as: 'business' });
  Order.belongsTo(Outlet, { foreignKey: 'outletId', as: 'outlet' });
  Order.belongsTo(Table, { foreignKey: 'tableId', as: 'table' });
  Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'orderItems' });

  // OrderItem associations
  OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
  OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
};

/**
 * Get models for current schema
 * This is a convenience function that returns models for the active schema
 */
const getModels = () => {
  const cacheKey = 'schema_models';
  if (!modelCache.has(cacheKey)) {
    throw new Error('Models not initialized. Call initModels() first.');
  }
  return modelCache.get(cacheKey);
};

/**
 * Clear model cache (useful for testing or hot reload)
 */
const clearModelCache = () => {
  modelCache.clear();
  console.log('🧹 Schema model cache cleared');
};

module.exports = {
  initModels,
  getModels,
  clearModelCache
};
