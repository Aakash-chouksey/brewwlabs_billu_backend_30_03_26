const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Product = sequelize.define('Product', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            field: 'id'
        },
        businessId: {
            field: 'business_id',
            type: DataTypes.UUID,
            allowNull: false
        },
        outletId: {
            field: 'outlet_id',
            type: DataTypes.UUID,
            allowNull: false,
            comment: 'Every product must belong to a specific outlet'
        },
        categoryId: {
            field: 'category_id',
            type: DataTypes.UUID,
            allowNull: false
        },
        productTypeId: {
            field: 'product_type_id',
            type: DataTypes.UUID,
            allowNull: true
        },
        name: {
            field: 'name',
            type: DataTypes.STRING,
            allowNull: false,
            validate: { notEmpty: true }
        },
        price: {
            field: 'price',
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00,
            validate: { min: 0 }
        },
        isActive: {
            field: 'is_active',
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        description: {
            field: 'description',
            type: DataTypes.TEXT
        },
        image: {
            field: 'image',
            type: DataTypes.STRING
        },
        sku: {
            field: 'sku',
            type: DataTypes.STRING,
            allowNull: true
        },
        barcode: {
            field: 'barcode',
            type: DataTypes.STRING,
            allowNull: true
        },
        cost: {
            field: 'cost',
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        taxRate: {
            field: 'tax_rate',
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false,
            defaultValue: 0.00
        },
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
        Product.belongsTo(models.Category, { foreignKey: 'categoryId', as: 'category', constraints: false });
        Product.belongsTo(models.Outlet, { foreignKey: 'outletId', as: 'outlet', constraints: false });
        Product.belongsTo(models.ProductType, { foreignKey: 'productTypeId', as: 'productType', constraints: false });
        Product.hasOne(models.Inventory, { foreignKey: 'productId', as: 'inventory' });
    };

    return Product;
};
