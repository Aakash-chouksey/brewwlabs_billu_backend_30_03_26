const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const OrderItem = sequelize.define('OrderItem', {
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
        orderId: {
            field: 'order_id',
            type: DataTypes.UUID,
            allowNull: false
        },
        productId: {
            field: 'product_id',
            type: DataTypes.UUID,
            allowNull: false
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: { notEmpty: true }
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
            validate: { min: 1 }
        },
        price: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00,
            validate: { min: 0 }
        },
        subtotal: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        status: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'PENDING'
        }
    }, {
        tableName: 'order_items',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['order_id'] },
            { fields: ['business_id'] }
        ]
    });

    OrderItem.associate = function(models) {
        // REMOVED cross-schema association to Business
        OrderItem.belongsTo(models.Order, { foreignKey: 'order_id', as: 'order' });
        OrderItem.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
    };

    return OrderItem;
};
