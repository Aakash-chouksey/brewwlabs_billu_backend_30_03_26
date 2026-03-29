const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Inventory = sequelize.define('Inventory', {
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
        productId: {
            field: 'product_id',
            type: DataTypes.UUID,
            allowNull: true // Optional for non-product inventory
        },
        itemName: {
            field: 'item_name',
            type: DataTypes.STRING,
            allowNull: true
        },
        quantity: {
            field: 'quantity',
            type: DataTypes.DECIMAL(10, 3),
            defaultValue: 0
        },
        unitCost: {
            field: 'unit_cost',
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0
        },
        location: {
            field: 'location',
            type: DataTypes.STRING,
            allowNull: true
        },
        reorderLevel: {
            field: 'reorder_level',
            type: DataTypes.DECIMAL(10, 3),
            defaultValue: 10
        },
        lastRestockedAt: {
            field: 'last_restocked_at',
            type: DataTypes.DATE
        }
    }, {
        tableName: 'inventory',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['business_id'] },
            { fields: ['business_id', 'outlet_id'] },
            { fields: ['business_id', 'outlet_id', 'product_id'] },
            { 
                name: 'inventory_outlet_item_name_unique',
                fields: ['outlet_id', 'item_name'],
                unique: true 
            }
        ]
    });

    Inventory.associate = function(models) {
        // REMOVED cross-schema association to Business
        Inventory.belongsTo(models.Outlet, { foreignKey: 'outletId', as: 'outlet' });
        Inventory.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
        Inventory.hasMany(models.InventoryTransaction, { foreignKey: 'inventoryId', as: 'transactions' });
    };

    return Inventory;
};
