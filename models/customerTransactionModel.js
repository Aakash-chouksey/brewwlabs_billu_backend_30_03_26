const { DataTypes } = require('sequelize');

// Factory function to create CustomerTransaction model for given sequelize instance
module.exports = (sequelize) => {
    const CustomerTransaction = sequelize.define('CustomerTransaction', {
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
        orderId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'order_id'
        },
        transactionType: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'transaction_type'
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        paymentMethod: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'payment_method'
        },
        description: {
            type: DataTypes.TEXT
        },
        transactionDate: {
            type: DataTypes.DATE,
            allowNull: false,
            field: 'transaction_date'
        },
        createdBy: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'created_by'
        }
    }, {
        tableName: 'customer_transactions',
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
                fields: ['business_id', 'outlet_id', 'transaction_date']
            },
            {
                fields: ['business_id', 'outlet_id', 'transaction_type']
            }
        ]
    });

    // Define associations
    CustomerTransaction.associate = function(models) {
        CustomerTransaction.belongsTo(models.Customer, { foreignKey: 'customerId', as: 'customer' });
        CustomerTransaction.belongsTo(models.Order, { foreignKey: 'orderId', as: 'order' });
        CustomerTransaction.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
    };

    return CustomerTransaction;
};
