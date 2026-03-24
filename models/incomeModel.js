const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Income = sequelize.define('Income', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        businessId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        outletId: {
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
            type: DataTypes.STRING,
            defaultValue: "Cash"
        }
    }, {
        timestamps: true
    });

    return Income;
};
