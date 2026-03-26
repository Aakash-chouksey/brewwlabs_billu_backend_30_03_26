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
        salePrice: {
            field: 'sale_price',
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        totalAmount: {
            field: 'total_amount',
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        saleDate: {
            field: 'sale_date',
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        customerName: {
            field: 'customer_name',
            type: DataTypes.STRING,
            allowNull: true
        },
        customerPhone: {
            field: 'customer_phone',
            type: DataTypes.STRING,
            allowNull: true
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
        }
    }, {
        tableName: 'inventory_sales',
        underscored: true,
        freezeTableName: true,
        timestamps: true
    });

    return InventorySale;
};
