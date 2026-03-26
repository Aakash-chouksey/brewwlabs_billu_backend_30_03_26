const { DataTypes } = require('sequelize');

/**
 * Inventory Sale Model
 * For direct inventory item sales (not through recipes)
 * Sychronized with inventorySaleController.js
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
        outletId: {
            field: 'outlet_id', // Note: This may be missing in some DB instances, but required for the model
            type: DataTypes.UUID,
            allowNull: true
        },
        inventoryId: {
            field: 'inventory_item_id',
            type: DataTypes.UUID,
            allowNull: false
        },
        productId: {
            field: 'product_id',
            type: DataTypes.UUID,
            allowNull: true
        },
        customerId: {
            field: 'customer_id',
            type: DataTypes.UUID,
            allowNull: true
        },
        quantity: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        unitPrice: {
            field: 'sale_price',
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        totalAmount: {
            field: 'total_amount',
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        soldBy: {
            field: 'recorded_by',
            type: DataTypes.UUID,
            allowNull: true
        }
    }, {
        tableName: 'inventory_sales',
        underscored: true,
        freezeTableName: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    InventorySale.associate = (models) => {
        InventorySale.belongsTo(models.Inventory, { foreignKey: 'inventoryId', as: 'inventory' });
        InventorySale.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
        InventorySale.belongsTo(models.Customer, { foreignKey: 'customerId', as: 'customer' });
        InventorySale.belongsTo(models.Outlet, { foreignKey: 'outletId', as: 'outlet' });
    };

    return InventorySale;
};

