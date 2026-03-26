const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Purchase = sequelize.define('Purchase', {
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
            allowNull: false,
            field: 'outlet_id'
        },
        supplierId: {
            field: 'supplier_id',
            type: DataTypes.UUID,
            allowNull: true,
            field: 'supplier_id'
        },
        supplierName: {
            field: 'supplier_name',
            type: DataTypes.STRING
        },
        totalAmount: {
            field: 'total_amount',
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
        freezeTableName: true,
        indexes: [
            { fields: ['business_id'] },
            { fields: ['business_id', 'outlet_id'] }
        ]
    });

    return Purchase;
};
