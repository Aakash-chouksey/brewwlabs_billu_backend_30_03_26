const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const InventoryTransaction = sequelize.define('InventoryTransaction', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        inventoryId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'inventory_id'
        },
        inventoryItemId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'inventory_item_id'
        },
        productId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'product_id'
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
        type: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'type'
        },
        transactionType: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'transaction_type'
        },
        quantity: {
            type: DataTypes.DECIMAL(10, 3),
            allowNull: false
        },
        unitCost: {
            type: DataTypes.DECIMAL(10, 2),
            field: 'unit_cost'
        },
        costPerUnit: {
            type: DataTypes.DECIMAL(10, 2),
            field: 'cost_per_unit'
        },
        totalCost: {
            type: DataTypes.DECIMAL(10, 2),
            field: 'total_cost'
        },
        previousQuantity: {
            type: DataTypes.DECIMAL(10, 3),
            field: 'previous_quantity'
        },
        previousStock: {
            type: DataTypes.DECIMAL(10, 3),
            field: 'previous_stock'
        },
        newQuantity: {
            type: DataTypes.DECIMAL(10, 3),
            field: 'new_quantity'
        },
        newStock: {
            type: DataTypes.DECIMAL(10, 3),
            field: 'new_stock'
        },
        performedBy: {
            type: DataTypes.UUID,
            field: 'performed_by'
        },
        createdBy: {
            type: DataTypes.UUID,
            field: 'created_by'
        },
        reference: {
            type: DataTypes.STRING
        },
        reason: {
            type: DataTypes.TEXT
        },
        notes: {
            type: DataTypes.TEXT
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
            { fields: ['inventory_id'] },
            { fields: ['product_id'] },
            { fields: ['type'] },
            { fields: ['created_at'] }
        ]
    });

    InventoryTransaction.associate = (models) => {
        InventoryTransaction.belongsTo(models.Inventory, { foreignKey: 'inventoryId', as: 'inventory' });
        InventoryTransaction.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
    };

    return InventoryTransaction;
};
