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
            field: 'inventory_category_id',
            type: DataTypes.UUID,
            allowNull: false
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
            type: DataTypes.STRING,
            field: 'supplier_name'
        },
        lastRestockedAt: {
            type: DataTypes.DATE,
            field: 'last_restocked_at'
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
            { fields: ['business_id', 'outlet_id', 'is_active'] },
            { fields: ['supplier_id'] }
        ]
    });

    InventoryItem.associate = (models) => {
        InventoryItem.belongsTo(models.InventoryCategory, { foreignKey: 'inventory_category_id', as: 'category' });
        InventoryItem.belongsTo(models.Supplier, { foreignKey: 'supplier_id', as: 'supplier' });
        InventoryItem.hasMany(models.InventoryTransaction, { foreignKey: 'inventory_item_id', as: 'transactions' });
    };

    return InventoryItem;
};
