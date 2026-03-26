const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Order = sequelize.define('Order', {
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
        orderNumber: {
            field: 'order_number',
            type: DataTypes.STRING(50),
            allowNull: false
        },
        customerDetails: {
            field: 'customer_details',
            type: DataTypes.JSONB,
            allowNull: true
        },
        tableId: {
            field: 'table_id',
            type: DataTypes.UUID,
            allowNull: true
        },
        status: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'CREATED'
        },
        billingSubtotal: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00,
            field: 'billing_subtotal'
        },
        billingTax: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00,
            field: 'billing_tax'
        },
        billingDiscount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00,
            field: 'billing_discount'
        },
        billingTotal: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00,
            field: 'billing_total'
        },
        paymentMethod: {
            field: 'payment_method',
            type: DataTypes.STRING(50),
            allowNull: true
        },
        paymentStatus: {
            field: 'payment_status',
            type: DataTypes.STRING(50),
            allowNull: true
        },
        createdAt: {
            field: 'created_at',
            type: DataTypes.DATE
        },
        updatedAt: {
            field: 'updated_at',
            type: DataTypes.DATE
        }
    }, {
        tableName: 'orders',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['business_id'] },
            { fields: ['outlet_id'] },
            { fields: ['business_id', 'outlet_id', 'created_at'] }
        ]
    });

    Order.associate = function(models) {
        Order.belongsTo(models.Outlet, { foreignKey: 'outlet_id', as: 'outlet' });
        Order.hasMany(models.OrderItem, { foreignKey: 'order_id', as: 'items' });
        Order.hasMany(models.Payment, { foreignKey: 'internalOrderId', as: 'payments' });
        Order.belongsTo(models.Table, { foreignKey: 'tableId', as: 'table' });
        Order.belongsTo(models.Customer, { foreignKey: 'customerId', as: 'customer' });
        Order.belongsTo(models.User, { foreignKey: 'staffId', as: 'staff', constraints: false });
    };

    return Order;
};