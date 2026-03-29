const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const InventoryTransaction = sequelize.define('InventoryTransaction', {
        id: {
            field: 'id',
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        inventoryId: {
            field: 'inventory_id',
            type: DataTypes.UUID,
            allowNull: true
        },
        inventoryItemId: {
            field: 'inventory_item_id',
            type: DataTypes.UUID,
            allowNull: true
        },
        productId: {
            field: 'product_id',
            type: DataTypes.UUID,
            allowNull: true
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
        type: {
            field: 'type',
            type: DataTypes.STRING,
            allowNull: true
        },
        transactionType: {
            field: 'transaction_type',
            type: DataTypes.STRING,
            allowNull: true
        },
        quantity: {
            field: 'quantity',
            type: DataTypes.DECIMAL(10, 3),
            allowNull: false
        },
        unitCost: {
            field: 'unit_cost',
            type: DataTypes.DECIMAL(10, 2)
        },
        costPerUnit: {
            field: 'cost_per_unit',
            type: DataTypes.DECIMAL(10, 2)
        },
        totalCost: {
            field: 'total_cost',
            type: DataTypes.DECIMAL(10, 2)
        },
        previousQuantity: {
            field: 'previous_quantity',
            type: DataTypes.DECIMAL(10, 3)
        },
        previousStock: {
            field: 'previous_stock',
            type: DataTypes.DECIMAL(10, 3)
        },
        newQuantity: {
            field: 'new_quantity',
            type: DataTypes.DECIMAL(10, 3)
        },
        newStock: {
            field: 'new_stock',
            type: DataTypes.DECIMAL(10, 3)
        },
        performedBy: {
            field: 'performed_by',
            type: DataTypes.UUID
        },
        createdBy: {
            field: 'created_by',
            type: DataTypes.UUID
        },
        reference: {
            field: 'reference',
            type: DataTypes.STRING
        },
        reason: {
            field: 'reason',
            type: DataTypes.TEXT
        },
        notes: {
            field: 'notes',
            type: DataTypes.TEXT
        },
        invoiceNumber: {
            field: 'invoice_number',
            type: DataTypes.STRING,
            allowNull: true
        },
        supplierId: {
            field: 'supplier_id',
            type: DataTypes.UUID,
            allowNull: true
        }
    }, {
        tableName: 'inventory_transactions',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['business_id'] },
            { fields: ['business_id', 'outlet_id'] },
            { fields: ['inventory_id'] },
            { fields: ['created_at'] }
        ]
    });

    InventoryTransaction.associate = (models) => {
        InventoryTransaction.belongsTo(models.Inventory, { foreignKey: 'inventoryId', as: 'inventory' });
        InventoryTransaction.belongsTo(models.InventoryItem, { foreignKey: 'inventoryItemId', as: 'inventoryItem' });
        InventoryTransaction.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
        InventoryTransaction.belongsTo(models.Supplier, { foreignKey: 'supplierId', as: 'supplier' });
    };

    return InventoryTransaction;
};
