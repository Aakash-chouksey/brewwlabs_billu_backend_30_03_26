const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const InventoryItem = sequelize.define('InventoryItem', {
        id: {
            field: 'id',
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            field: 'name',
            type: DataTypes.STRING,
            allowNull: false
        },
        inventoryCategoryId: {
            field: 'inventory_category_id',
            type: DataTypes.UUID,
            allowNull: false
        },
        unit: {
            field: 'unit',
            type: DataTypes.STRING,
            defaultValue: 'piece'
        },
        sku: {
            field: 'sku',
            type: DataTypes.STRING,
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
        currentStock: {
            field: 'current_stock',
            type: DataTypes.DECIMAL(10, 3),
            defaultValue: 0
        },
        minimumStock: {
            field: 'minimum_stock',
            type: DataTypes.DECIMAL(10, 3),
            defaultValue: 5
        },
        costPerUnit: {
            field: 'cost_per_unit',
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0
        },
        supplierId: {
            field: 'supplier_id',
            type: DataTypes.UUID,
            allowNull: true
        },
        supplierName: {
            field: 'supplier_name',
            type: DataTypes.STRING
        },
        lastRestockedAt: {
            field: 'last_restocked_at',
            type: DataTypes.DATE
        },
        isActive: {
            field: 'is_active',
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        tableName: 'inventory_items',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['business_id'] },
            { fields: ['business_id', 'outlet_id'] },
            { fields: ['business_id', 'outlet_id', 'name'], unique: true },
            { fields: ['business_id', 'outlet_id', 'inventory_category_id'] },
            // { fields: ['business_id', 'outlet_id', 'is_active'] }  // TODO: Re-enable
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
