const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const TenantRegistry = sequelize.define('TenantRegistry', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        businessId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'business_id',
            unique: true
        },
        schemaName: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'schema_name',
            unique: true
        },
        status: {
            type: DataTypes.ENUM('active', 'suspended', 'onboarding', 'deleted', 'pending_approval', 'pending'),
            defaultValue: 'active'
        },
        createdAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            field: 'created_at'
        }
    }, {
        tableName: 'tenant_registry',
        timestamps: false,
        underscored: true
    });

    return TenantRegistry;
};
