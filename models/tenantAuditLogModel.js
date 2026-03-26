const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const TenantAuditLog = sequelize.define('TenantAuditLog', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        userId: {
            field: 'user_id',
            type: DataTypes.UUID, allowNull: false },
        userName: {
            field: 'user_name',
            type: DataTypes.STRING },
        userRole: {
            field: 'user_role',
            type: DataTypes.STRING },
        action: { type: DataTypes.STRING, allowNull: false },
        module: { type: DataTypes.STRING, allowNull: false },
        targetId: {
            field: 'target_id',
            type: DataTypes.UUID },
        businessId: {
            type: DataTypes.UUID, field: 'business_id', allowNull: false },
        outletId: {
            type: DataTypes.UUID, field: 'outlet_id' },
        details: { type: DataTypes.JSONB },
        ipAddress: {
            field: 'ip_address',
            type: DataTypes.STRING },
        userAgent: {
            field: 'user_agent',
            type: DataTypes.STRING }
    }, {
        tableName: 'audit_logs',
        underscored: true,
        freezeTableName: true,
        timestamps: true
    });

    return TenantAuditLog;
};
