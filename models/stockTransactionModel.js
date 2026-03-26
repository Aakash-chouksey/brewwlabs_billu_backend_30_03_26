const { DataTypes } = require('sequelize');

/**
 * Stock Transaction Model
 * For inventory stock adjustments, purchases, and self-consumption
 */
module.exports = (sequelize) => {
    const StockTransaction = sequelize.define('StockTransaction', {
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
        type: {
            type: DataTypes.ENUM('PURCHASE', 'SELF_CONSUME', 'ADJUSTMENT', 'SALE', 'WASTAGE'),
            allowNull: false
        },
        quantity: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        unitCost: {
            field: 'unit_cost',
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        totalCost: {
            field: 'total_cost',
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        previousStock: {
            field: 'previous_stock',
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        newStock: {
            field: 'new_stock',
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        supplierId: {
            field: 'supplier_id',
            type: DataTypes.UUID,
            allowNull: true
        },
        recipeId: {
            field: 'recipe_id',
            type: DataTypes.UUID,
            allowNull: true
        },
        invoiceNumber: {
            field: 'invoice_number',
            type: DataTypes.STRING,
            allowNull: true
        },
        reason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        adjustmentType: {
            field: 'adjustment_type',
            type: DataTypes.ENUM('ADD', 'REMOVE'),
            allowNull: true
        },
        transactionDate: {
            field: 'transaction_date',
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        recordedBy: {
            field: 'recorded_by',
            type: DataTypes.UUID,
            allowNull: true,
            // Cross-schema FKs are tricky during sync, removing constraint for now
        }
    }, {
        tableName: 'stock_transactions',
        underscored: true,
        freezeTableName: true,
        timestamps: true
    });

    return StockTransaction;
};
