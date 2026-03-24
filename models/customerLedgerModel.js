const { DataTypes } = require('sequelize');

// Factory function to create CustomerLedger model for given sequelize instance
module.exports = (sequelize) => {
    const CustomerLedger = sequelize.define('CustomerLedger', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        businessId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'business_id'
        },
        outletId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'outlet_id'
        },
        customerId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'customer_id'
        },
        transactionId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'transaction_id'
        },
        orderId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'order_id'
        },
        entryType: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'entry_type'
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        balanceBefore: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            field: 'balance_before'
        },
        balanceAfter: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            field: 'balance_after'
        },
        entryDate: {
            type: DataTypes.DATE,
            allowNull: false,
            field: 'entry_date'
        }
    }, {
        tableName: 'customer_ledger',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['business_id']
            },
            {
                fields: ['business_id', 'outlet_id']
            },
            {
                fields: ['business_id', 'outlet_id', 'customer_id']
            },
            {
                fields: ['business_id', 'outlet_id', 'customer_id', 'entry_date']
            },
            {
                fields: ['business_id', 'outlet_id', 'transaction_id']
            }
        ]
    });

    // Define associations
    CustomerLedger.associate = function(models) {
        CustomerLedger.belongsTo(models.Customer, { foreignKey: 'customerId', as: 'customer' });
        CustomerLedger.belongsTo(models.CustomerTransaction, { foreignKey: 'transactionId', as: 'transaction' });
        CustomerLedger.belongsTo(models.Order, { foreignKey: 'orderId', as: 'order' });
    };

    return CustomerLedger;
};
