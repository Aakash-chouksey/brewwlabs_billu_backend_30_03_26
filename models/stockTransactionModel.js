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
        type: {
            type: DataTypes.ENUM('PURCHASE', 'SELF_CONSUME', 'ADJUSTMENT', 'SALE', 'WASTAGE'),
            allowNull: false
        },
        quantity: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        unitCost: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        totalCost: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        previousStock: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        newStock: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        supplierId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'suppliers',
                key: 'id'
            }
        },
        recipeId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'recipes',
                key: 'id'
            }
        },
        invoiceNumber: {
            type: DataTypes.STRING,
            allowNull: true
        },
        reason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        adjustmentType: {
            type: DataTypes.ENUM('ADD', 'REMOVE'),
            allowNull: true
        },
        transactionDate: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        recordedBy: {
            type: DataTypes.UUID,
            allowNull: true,
            // Cross-schema FKs are tricky during sync, removing constraint for now
        }
    }, {
        tableName: 'StockTransactions',
        timestamps: true
    });

    return StockTransaction;
};
