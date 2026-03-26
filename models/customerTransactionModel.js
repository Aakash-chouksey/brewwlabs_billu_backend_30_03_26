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
        orderId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'order_id'
        },
        transactionType: {
            field: 'transaction_type',
            type: DataTypes.STRING,
            allowNull: false
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        paymentMethod: {
            field: 'payment_method',
            type: DataTypes.STRING,
            allowNull: true
        },
        description: {
            type: DataTypes.TEXT
        },
        transactionDate: {
            field: 'transaction_date',
            type: DataTypes.DATE,
            allowNull: false
        },
        createdBy: {
            field: 'created_by',
            type: DataTypes.UUID,
            allowNull: true
        }
    }, {
        tableName: 'customer_transactions',
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
                fields: ['business_id', 'outlet_id', 'transaction_date']
            },
            {
                fields: ['business_id', 'outlet_id', 'transaction_type']
            }
        ]
    });

    // Define associations
    CustomerTransaction.associate = function(models) {
        CustomerTransaction.belongsTo(models.Customer, { foreignKey: 'customer_id', as: 'customer' });
        CustomerTransaction.belongsTo(models.Order, { foreignKey: 'order_id', as: 'order' });
    };

    return CustomerTransaction;
};
