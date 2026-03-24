const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const InventoryItem = sequelize.define('InventoryItem', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        inventoryCategoryId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'inventory_category_id'
        },
        unit: {
            type: DataTypes.STRING,
            defaultValue: 'piece'
        },
        sku: {
            type: DataTypes.STRING,
            allowNull: true
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
        currentStock: {
            type: DataTypes.DECIMAL(10, 3),
            defaultValue: 0,
            field: 'current_stock'
        },
        minimumStock: {
            type: DataTypes.DECIMAL(10, 3),
            defaultValue: 5,
            field: 'minimum_stock'
        },
        costPerUnit: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
            field: 'cost_per_unit'
        },
        supplierId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'supplier_id'
        },
        supplierName: {
            type: DataTypes.STRING,
            field: 'supplier_name'
        },
        lastRestockedAt: {
            type: DataTypes.DATE,
            field: 'last_restocked_at'
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            field: 'is_active'
        }
    }, {
        tableName: 'inventory_items',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['business_id'] },
            { fields: ['business_id', 'outlet_id'] },
            { fields: ['business_id', 'outlet_id', 'name'], unique: true },
            { fields: ['business_id', 'outlet_id', 'inventory_category_id'] },
            { fields: ['business_id', 'outlet_id', 'is_active'] },
            { fields: ['supplier_id'] }
        ]
    });

    InventoryItem.associate = (models) => {
        InventoryItem.belongsTo(models.InventoryCategory, { foreignKey: 'inventoryCategoryId', as: 'category' });
        InventoryItem.belongsTo(models.Supplier, { foreignKey: 'supplierId', as: 'supplier' });
        InventoryItem.hasMany(models.InventoryTransaction, { foreignKey: 'inventoryItemId', as: 'transactions' });
    };

    return InventoryItem;
};
