const { DataTypes } = require('sequelize');

// Factory function to create ProductType model for given sequelize instance
module.exports = (sequelize) => {
    const ProductType = sequelize.define('ProductType', {
        id: {
            field: 'id',
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        businessId: {
            field: 'business_id',
            type: DataTypes.UUID,
            allowNull: false
        },
        outletId: {
            field: 'outlet_id',
            type: DataTypes.UUID,
            allowNull: false
        },
        name: {
            field: 'name',
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            field: 'description',
            type: DataTypes.STRING,
            allowNull: true
        },
        icon: {
            field: 'icon',
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: '🥬'
        },
        color: {
            field: 'color',
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: '#10B981'
        },
        categoryId: {
            field: 'category_id',
            type: DataTypes.UUID,
            allowNull: true
        }
    }, {
        tableName: 'product_types',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        indexes: [
            { fields: ['business_id'] },
            { fields: ['business_id', 'outlet_id'] },
            { fields: ['category_id'] }
        ]
    });

    // Define associations
    ProductType.associate = function(models) {
        ProductType.hasMany(models.Product, { foreignKey: 'productTypeId', as: 'products' });
        ProductType.belongsTo(models.Category, { foreignKey: 'categoryId', as: 'category' });
    };

    return ProductType;
};
