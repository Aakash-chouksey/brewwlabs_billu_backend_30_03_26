const { DataTypes } = require('sequelize');

// Factory function to create ProductType model for given sequelize instance
module.exports = (sequelize) => {
    const ProductType = sequelize.define('ProductType', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    businessId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'business_id'
    },
    outletId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'outlet_id'
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true
    },
    icon: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: '🥬'
    },
    color: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: '#10B981'
    }
}, {
    tableName: 'product_types',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            fields: ['business_id']
        },
        {
            fields: ['business_id', 'outlet_id']
        }
    ]
});

    // Define associations
    ProductType.associate = function(models) {
        ProductType.hasMany(models.Product, { foreignKey: 'productTypeId', as: 'products' });
    };

    return ProductType;
};
