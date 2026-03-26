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
            field: 'business_id',
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
            field: 'open_time',
            type: DataTypes.TIME,
            allowNull: true
        },
        closeTime: {
            field: 'close_time',
            type: DataTypes.TIME,
            allowNull: true
        },
        isOpen: {
            field: 'is_open',
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        specialHours: {
            field: 'special_hours',
            type: DataTypes.JSON,
            allowNull: true
        }
    }, {
        tableName: 'operation_timings',
        underscored: true,
        freezeTableName: true,
        timestamps: true
    });

    return OperationTiming;
};
