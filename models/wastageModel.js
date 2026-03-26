const { DataTypes } = require('sequelize');

/**
 * Wastage Model
 * For inventory wastage tracking
 */
module.exports = (sequelize) => {
    const Wastage = sequelize.define('Wastage', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        businessId: {
            field: 'business_id',
            type: DataTypes.UUID,
            allowNull: false
        },
        inventoryItemId: {
            field: 'inventory_item_id',
            type: DataTypes.UUID,
            allowNull: false
        },
        quantity: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        reason: {
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
            type: DataTypes.TEXT,
            allowNull: true
        },
        recordedBy: {
            field: 'recorded_by',
            type: DataTypes.UUID,
            allowNull: true,
            // Cross-schema FKs are tricky during sync, removing constraint for now
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
        timestamps: true
    });

    Wastage.associate = (models) => {
        Wastage.belongsTo(models.Inventory, { foreignKey: 'inventoryItemId', as: 'inventory' });
    };

    return Wastage;
};
