const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const AuditLog = sequelize.define('AuditLog', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        userId: { type: DataTypes.UUID, allowNull: false },
        userName: { type: DataTypes.STRING },
        userRole: { type: DataTypes.STRING },
        action: { type: DataTypes.STRING, allowNull: false },
        module: { type: DataTypes.STRING, allowNull: false },
        targetId: { type: DataTypes.UUID },
        businessId: { type: DataTypes.UUID, field: 'business_id', allowNull: false },
        outletId: { type: DataTypes.UUID, field: 'outlet_id' },
        details: { type: DataTypes.JSONB },
        ipAddress: { type: DataTypes.STRING },
        userAgent: { type: DataTypes.STRING }
    }, {
        timestamps: true
    });

    return AuditLog;
};
