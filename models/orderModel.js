const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Order = sequelize.define('Order', {
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
        customerId: {
            field: 'customer_id',
            type: DataTypes.UUID,
            allowNull: true
        },
        staffId: {
            field: 'staff_id',
            type: DataTypes.UUID,
            allowNull: true
        },
        status: {
            field: 'status',
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'CREATED'
        },
        billingSubtotal: {
            field: 'billing_subtotal',
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        billingTax: {
            field: 'billing_tax',
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        billingDiscount: {
            field: 'billing_discount',
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        billingTotal: {
            field: 'billing_total',
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00
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
        type: {
            field: 'type',
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'DINE_IN'
        },
        notes: {
            field: 'notes',
            type: DataTypes.TEXT,
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
        Order.belongsTo(models.Outlet, { foreignKey: 'outletId', as: 'outlet' });
        Order.hasMany(models.OrderItem, { foreignKey: 'orderId', as: 'items' });
        Order.hasMany(models.Payment, { foreignKey: 'internalOrderId', as: 'payments' });
        Order.belongsTo(models.Table, { foreignKey: 'tableId', as: 'table' });
        Order.belongsTo(models.Customer, { foreignKey: 'customerId', as: 'customer' });
        Order.belongsTo(models.User, { foreignKey: 'staffId', as: 'staff', constraints: false });
    };

    return Order;
};