const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Product = sequelize.define('Product', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        businessId: {
            field: 'business_id',
            type: DataTypes.UUID,
            allowNull: false,
            field: 'business_id'
        },
        outletId: {
            field: 'outlet_id',
            type: DataTypes.UUID,
            allowNull: false,
            field: 'outlet_id',
            comment: 'Every product must belong to a specific outlet'
        },
        categoryId: {
            field: 'category_id',
            type: DataTypes.UUID,
            allowNull: false,
            field: 'category_id'
        },
        productTypeId: {
            field: 'product_type_id',
            type: DataTypes.UUID,
            allowNull: true, // Fixed: set to true to avoid breaking existing data
            field: 'product_type_id'
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: { notEmpty: true }
        },
        price: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00,
            validate: { min: 0 }
        },
        isActive: {
            field: 'is_active',
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            field: 'is_active'
        },
        description: {
            type: DataTypes.TEXT,
            field: 'description'
        },
        image: {
            type: DataTypes.STRING,
            field: 'image'
        },
        sku: {
            type: DataTypes.STRING,
            field: 'sku',
            allowNull: true
        },
        currentStock: {
            field: 'current_stock',
            type: DataTypes.DECIMAL(15, 2),
            allowNull: true,
            defaultValue: 0.00,
            field: 'current_stock'
        }
    }, {
        tableName: 'products',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['business_id'] },
            { fields: ['business_id', 'outlet_id'] },
            { fields: ['category_id'] },
            { fields: ['sku'] },
            { 
                name: 'products_business_outlet_name_unique',
                fields: ['business_id', 'outlet_id', 'name'],
                unique: true 
            }
        ]
    });

    Product.associate = function(models) {
        // REMOVED cross-schema association to Business
        Product.belongsTo(models.Category, { foreignKey: 'category_id', as: 'category', constraints: false });
        Product.belongsTo(models.Outlet, { foreignKey: 'outlet_id', as: 'outlet', constraints: false });
        Product.belongsTo(models.ProductType, { foreignKey: 'product_type_id', as: 'productType', constraints: false });
    };

    return Product;
};
