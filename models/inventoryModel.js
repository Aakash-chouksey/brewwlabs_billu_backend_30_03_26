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
        itemName: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'item_name'
        },
        stockQuantity: {
            type: DataTypes.FLOAT,
            defaultValue: 0,
            field: 'stock_quantity'
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
    };

    return Inventory;
};
