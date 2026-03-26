const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Timing = sequelize.define('Timing', {
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
        day: {
            type: DataTypes.STRING,
            allowNull: false
        },
        openTime: {
            field: 'open_time',
            type: DataTypes.STRING, // e.g., "09:00"
            allowNull: false
        },
        closeTime: {
            field: 'close_time',
            type: DataTypes.STRING, // e.g., "22:00"
            allowNull: false
        },
        isClosed: {
            field: 'is_closed',
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'timings',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        indexes: [
            {
                fields: ['business_id']
            },
            {
                fields: ['business_id', 'outlet_id']
            }
        ]
    });

    return Timing;
};
