const { DataTypes } = require('sequelize');

/**
 * Wastage Model
 * For inventory wastage tracking
 */
module.exports = (sequelize) => {
    const Wastage = sequelize.define('Wastage', {
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
        quantity: {
            field: 'quantity',
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        reason: {
            field: 'reason',
            type: DataTypes.STRING,
            allowNull: false
        },
        wastageDate: {
            field: 'wastage_date',
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        notes: {
            field: 'notes',
            type: DataTypes.TEXT,
            allowNull: true
        },
        recordedBy: {
            field: 'recorded_by',
            type: DataTypes.UUID,
            allowNull: true
        },
        costValue: {
            field: 'cost_value',
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        }
    }, {
        tableName: 'wastages',
        underscored: true,
        freezeTableName: true,
        timestamps: true,
        indexes: [
            { fields: ['business_id'] },
            { fields: ['business_id', 'outlet_id'] },
            { fields: ['inventory_id'] },
            { fields: ['wastage_date'] }
        ]
    });

    Wastage.associate = (models) => {
        Wastage.belongsTo(models.Inventory, { foreignKey: 'inventoryId', as: 'inventory' });
        Wastage.belongsTo(models.InventoryItem, { foreignKey: 'inventoryItemId', as: 'inventoryItem' });
    };

    return Wastage;
};
