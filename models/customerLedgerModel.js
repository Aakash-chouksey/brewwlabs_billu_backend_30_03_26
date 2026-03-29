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
            field: 'business_id',
            type: DataTypes.UUID,
            allowNull: false
        },
        outletId: {
            field: 'outlet_id',
            type: DataTypes.UUID,
            allowNull: false
        },
        customerId: {
            field: 'customer_id',
            type: DataTypes.UUID,
            allowNull: false
        },
        transactionId: {
            field: 'transaction_id',
            type: DataTypes.UUID,
            allowNull: true
        },
        orderId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'order_id'
        },
        entryType: {
            field: 'entry_type',
            type: DataTypes.STRING,
            allowNull: false
        },
        amount: {
            field: 'amount',
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        description: {
            field: 'description',
            type: DataTypes.TEXT,
            allowNull: false
        },
        balanceBefore: {
            field: 'balance_before',
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        balanceAfter: {
            field: 'balance_after',
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        entryDate: {
            field: 'entry_date',
            type: DataTypes.DATE,
            allowNull: false
        }
    }, {
        tableName: 'customer_ledger',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
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
        CustomerLedger.belongsTo(models.Customer, { foreignKey: 'customer_id', as: 'customer' });
        CustomerLedger.belongsTo(models.CustomerTransaction, { foreignKey: 'transaction_id', as: 'transaction' });
        CustomerLedger.belongsTo(models.Order, { foreignKey: 'order_id', as: 'order' });
    };

    return CustomerLedger;
};
