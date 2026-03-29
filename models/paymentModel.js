const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Payment = sequelize.define('Payment', {
        id: {
            field: 'id',
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
            allowNull: true
        },
        paymentId: {
            field: 'payment_id',
            type: DataTypes.STRING 
        },
        orderId: {
            field: 'order_id',
            type: DataTypes.STRING 
        }, // Razorpay Order ID
        internalOrderId: {
            field: 'internal_order_id',
            type: DataTypes.UUID, 
            allowNull: true 
        },
        amount: { 
            field: 'amount',
            type: DataTypes.DECIMAL(10, 2) 
        },
        currency: { 
            field: 'currency',
            type: DataTypes.STRING 
        },
        status: { 
            field: 'status',
            type: DataTypes.STRING 
        },
        method: { 
            field: 'method',
            type: DataTypes.STRING 
        },
        email: { 
            field: 'email',
            type: DataTypes.STRING 
        },
        contact: { 
            field: 'contact',
            type: DataTypes.STRING 
        }
    }, {
        tableName: 'payments',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        indexes: [
            {
                fields: ['business_id']
            },
            {
                fields: ['business_id', 'outlet_id']
            }
        ]
    });

    Payment.associate = function(models) {
        Payment.belongsTo(models.Order, { foreignKey: 'internalOrderId', as: 'order' });
        Payment.belongsTo(models.Outlet, { foreignKey: 'outlet_id', as: 'outlet' });
    };

    return Payment;
};