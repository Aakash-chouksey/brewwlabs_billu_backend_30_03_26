const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Timing = sequelize.define('Timing', {
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
        day: {
            type: DataTypes.STRING,
            allowNull: false
        },
        openTime: {
            type: DataTypes.STRING, // e.g., "09:00"
            allowNull: false
        },
        closeTime: {
            type: DataTypes.STRING, // e.g., "22:00"
            allowNull: false
        },
        isClosed: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'timings',
        timestamps: true,
        underscored: true,
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
