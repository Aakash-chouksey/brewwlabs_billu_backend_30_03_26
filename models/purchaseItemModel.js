const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PurchaseItem = sequelize.define('PurchaseItem', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        purchaseId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'purchase_id'
        },
        productId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'product_id'
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        costPrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            field: 'cost_price'
        },
        quantity: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        unit: {
            type: DataTypes.STRING
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
        }
    }, {
        tableName: 'purchase_items',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['purchase_id'] },
            { fields: ['business_id', 'outlet_id'] }
        ]
    });

    return PurchaseItem;
};
