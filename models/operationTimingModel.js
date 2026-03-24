const { DataTypes } = require('sequelize');

/**
 * Operation Timing Model
 * For restaurant operation hours
 */
module.exports = (sequelize) => {
    const OperationTiming = sequelize.define('OperationTiming', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        businessId: {
            type: DataTypes.UUID,
            allowNull: false
        },
        day: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isIn: [['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']]
            }
        },
        openTime: {
            type: DataTypes.TIME,
            allowNull: true
        },
        closeTime: {
            type: DataTypes.TIME,
            allowNull: true
        },
        isOpen: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        specialHours: {
            type: DataTypes.JSON,
            allowNull: true
        }
    }, {
        tableName: 'OperationTimings',
        timestamps: true
    });

    return OperationTiming;
};
