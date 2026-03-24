const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Purchase = sequelize.define('Purchase', {
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
        supplierId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'supplier_id'
        },
        supplierName: {
            type: DataTypes.STRING
        },
        totalAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        items: {
            type: DataTypes.JSONB, // List of items purchased
            defaultValue: []
        },
        date: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        status: {
            type: DataTypes.STRING,
            defaultValue: 'Completed'
        }
    }, {
        tableName: 'purchases',
        timestamps: true,
        underscored: true,
        indexes: [
            { fields: ['business_id'] },
            { fields: ['business_id', 'outlet_id'] }
        ]
    });

    return Purchase;
};
