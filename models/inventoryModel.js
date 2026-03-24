const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Inventory = sequelize.define('Inventory', {
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
        productId: {
            type: DataTypes.UUID,
            allowNull: true, // Optional for non-product inventory
            field: 'product_id'
        },
        itemName: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'item_name'
        },
        quantity: {
            type: DataTypes.DECIMAL(10, 3),
            defaultValue: 0,
            field: 'quantity'
        },
        unitCost: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
            field: 'unit_cost'
        },
        location: {
            type: DataTypes.STRING,
            allowNull: true
        },
        reorderLevel: {
            type: DataTypes.DECIMAL(10, 3),
            defaultValue: 10,
            field: 'reorder_level'
        },
        lastRestockedAt: {
            type: DataTypes.DATE,
            field: 'last_restocked_at'
        }
    }, {
        tableName: 'inventory',
        timestamps: true,
        underscored: true,
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
        Inventory.belongsTo(models.Business, { foreignKey: 'business_id', as: 'business' });
        Inventory.belongsTo(models.Outlet, { foreignKey: 'outlet_id', as: 'outlet' });
        Inventory.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
    };

    return Inventory;
};
