const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PurchaseItem = sequelize.define('PurchaseItem', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        purchaseId: {
            field: 'purchase_id',
            type: DataTypes.UUID,
            allowNull: false
        },
        productId: {
            field: 'product_id',
            type: DataTypes.UUID,
            allowNull: false
        },
        name: {
            field: 'name',
            type: DataTypes.STRING,
            allowNull: false
        },
        costPrice: {
            field: 'cost_price',
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        quantity: {
            field: 'quantity',
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        unit: {
            field: 'unit',
            type: DataTypes.STRING
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
        }
    }, {
        tableName: 'purchase_items',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['purchase_id'] },
            { fields: ['business_id', 'outlet_id'] }
        ]
    });

    return PurchaseItem;
};
