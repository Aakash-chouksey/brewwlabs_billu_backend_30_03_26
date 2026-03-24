const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const InventoryTransaction = sequelize.define('InventoryTransaction', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        inventoryItemId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'inventory_item_id'
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
        transactionType: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'transaction_type'
        },
        quantity: {
            type: DataTypes.DECIMAL(10, 3),
            allowNull: false
        },
        reference: {
            type: DataTypes.STRING,
            comment: 'Reference to order ID, purchase ID, etc.'
        },
        reason: {
            type: DataTypes.TEXT,
            field: 'reason'
        },
        costPerUnit: {
            type: DataTypes.DECIMAL(10, 2),
            field: 'cost_per_unit'
        },
        totalCost: {
            type: DataTypes.DECIMAL(10, 2),
            field: 'total_cost'
        },
        supplier: {
            type: DataTypes.STRING
        },
        fromOutletId: {
            type: DataTypes.UUID,
            field: 'from_outlet_id'
        },
        toOutletId: {
            type: DataTypes.UUID,
            field: 'to_outlet_id'
        },
        previousStock: {
            type: DataTypes.DECIMAL(10, 3),
            field: 'previous_stock'
        },
        newStock: {
            type: DataTypes.DECIMAL(10, 3),
            field: 'new_stock'
        },
        createdBy: {
            type: DataTypes.UUID,
            field: 'created_by'
        },
        createdAt: {
            type: DataTypes.DATE,
            field: 'created_at'
        },
        updatedAt: {
            type: DataTypes.DATE,
            field: 'updated_at'
        }
    }, {
        tableName: 'inventory_transactions',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['business_id'] },
            { fields: ['business_id', 'outlet_id'] },
            { fields: ['inventory_item_id'] },
            { fields: ['business_id', 'outlet_id', 'transaction_type'] },
            { fields: ['business_id', 'outlet_id', 'created_at'] },
            { fields: ['reference'] }
        ]
    });

    InventoryTransaction.associate = (models) => {
        InventoryTransaction.belongsTo(models.InventoryItem, { foreignKey: 'inventoryItemId', as: 'inventoryItem' });
    };

    return InventoryTransaction;
};
