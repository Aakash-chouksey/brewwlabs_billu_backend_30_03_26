const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Payment = sequelize.define('Payment', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        businessId: {
            field: 'business_id',
            type: DataTypes.UUID,
            allowNull: false,
            field: 'business_id'
        },
        outletId: {
            field: 'outlet_id',
            type: DataTypes.UUID,
            allowNull: true,
            field: 'outlet_id'
        },
        
        paymentId: {
        
            field: 'payment_id',
            type: DataTypes.STRING },
        orderId: {
            field: 'order_id',
            type: DataTypes.STRING }, // Razorpay Order ID
        internalOrderId: {
            field: 'internal_order_id',
            type: DataTypes.UUID, allowNull: true },
        
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