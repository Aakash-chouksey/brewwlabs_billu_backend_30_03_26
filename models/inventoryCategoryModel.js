const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const InventoryCategory = sequelize.define('InventoryCategory', {
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
        name: {
            field: 'name',
            type: DataTypes.STRING,
            allowNull: false
        },
        isActive: {
            field: 'is_active',
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        tableName: 'inventory_categories',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        indexes: [
            { fields: ['business_id'] },
            { fields: ['business_id', 'outlet_id'] },
            { fields: ['business_id', 'outlet_id', 'name'], unique: true }
        ]
    });

    InventoryCategory.associate = (models) => {
        InventoryCategory.hasMany(models.InventoryItem, { foreignKey: 'inventoryCategoryId', as: 'items' });
    };

    return InventoryCategory;
};
