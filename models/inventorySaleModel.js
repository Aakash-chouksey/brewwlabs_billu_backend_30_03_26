const { DataTypes } = require('sequelize');

/**
 * Inventory Sale Model
 * For direct inventory item sales (not through recipes)
 */
module.exports = (sequelize) => {
    const InventorySale = sequelize.define('InventorySale', {
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
        salePrice: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        totalAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        saleDate: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        customerName: {
            type: DataTypes.STRING,
            allowNull: true
        },
        customerPhone: {
            type: DataTypes.STRING,
            allowNull: true
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        recordedBy: {
            type: DataTypes.UUID,
            allowNull: true,
            // Cross-schema FKs are tricky during sync, removing constraint for now
        }
    }, {
        tableName: 'InventorySales',
        timestamps: true
    });

    return InventorySale;
};
