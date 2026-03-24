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
            type: DataTypes.UUID,
            allowNull: false
        },
        inventoryItemId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'inventory_items',
                key: 'id'
            }
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
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        recordedBy: {
            type: DataTypes.UUID,
            allowNull: true,
            // Cross-schema FKs are tricky during sync, removing constraint for now
        },
        costValue: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        }
    }, {
        tableName: 'Wastages',
        timestamps: true
    });

    return Wastage;
};
