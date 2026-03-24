const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Order = sequelize.define('Order', {
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
        orderNumber: {
            type: DataTypes.STRING(50),
            allowNull: false,
            field: 'order_number'
        },
        customerDetails: {
            type: DataTypes.JSONB,
            allowNull: true,
            field: 'customer_details'
        },
        tableId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'table_id'
        },
        status: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'CREATED'
        },
        billing_subtotal: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00,
            field: 'billing_subtotal'
        },
        billing_tax: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00,
            field: 'billing_tax'
        },
        billing_discount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00,
            field: 'billing_discount'
        },
        billing_total: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00,
            field: 'billing_total'
        },
        paymentMethod: {
            type: DataTypes.STRING(50),
            allowNull: true,
            field: 'payment_method'
        },
        paymentStatus: {
            type: DataTypes.STRING(50),
            allowNull: true,
            field: 'payment_status'
        },
        createdAt: {
            type: DataTypes.DATE,
            field: 'created_at'
        },
        updatedAt: {
            type: DataTypes.DATE,
            field: 'updated_at'
        }
    }, {
        tableName: 'orders',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['business_id'] },
            { fields: ['outlet_id'] },
            { fields: ['business_id', 'outlet_id', 'created_at'] }
        ]
    });

    Order.associate = function(models) {
        Order.belongsTo(models.Business, { foreignKey: 'business_id', as: 'business' });
        Order.belongsTo(models.Outlet, { foreignKey: 'outlet_id', as: 'outlet' });
        Order.hasMany(models.OrderItem, { foreignKey: 'order_id', as: 'items' });
    };

    return Order;
};