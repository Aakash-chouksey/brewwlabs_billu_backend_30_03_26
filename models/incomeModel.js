const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Income = sequelize.define('Income', {
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
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        source: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.STRING
        },
        date: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        paymentMethod: {
            field: 'payment_method',
            type: DataTypes.STRING,
            defaultValue: "Cash"
        }
    }, {
        tableName: 'incomes',
        underscored: true,
        freezeTableName: true,
        timestamps: true
    });

    return Income;
};
