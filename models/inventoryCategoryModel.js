const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const InventoryCategory = sequelize.define('InventoryCategory', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        businessId: {
            field: 'business_id',
            type: DataTypes.UUID,
            allowNull: false,
            field: 'business_id'
        },
        outletId: {
            field: 'outlet_id',
            type: DataTypes.UUID,
            allowNull: false,
            field: 'outlet_id'
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        }
    }, {
        tableName: 'inventory_categories',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        indexes: [
            {
                fields: ['business_id']
            },
            {
                fields: ['business_id', 'outlet_id']
            },
            {
                fields: ['business_id', 'outlet_id', 'name'],
                unique: true
            }
        ]
    });

    InventoryCategory.associate = (models) => {
        InventoryCategory.hasMany(models.InventoryItem, { foreignKey: 'inventoryCategoryId', as: 'items' });
    };

    return InventoryCategory;
};
