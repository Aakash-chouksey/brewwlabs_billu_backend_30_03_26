const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Payment = sequelize.define('Payment', {
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
            allowNull: true,
            field: 'outlet_id'
        },
        
        paymentId: { type: DataTypes.STRING },
        orderId: { type: DataTypes.STRING }, // Razorpay Order ID
        internalOrderId: { type: DataTypes.UUID, allowNull: true },
        
        amount: { type: DataTypes.DECIMAL(10, 2) },
        currency: { type: DataTypes.STRING },
        status: { type: DataTypes.STRING },
        method: { type: DataTypes.STRING },
        email: { type: DataTypes.STRING },
        contact: { type: DataTypes.STRING }
    }, {
        tableName: 'payments',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                fields: ['business_id']
            },
            {
                fields: ['business_id', 'outlet_id']
            }
        ]
    });

    return Payment;
};