const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const TenantRegistry = sequelize.define('TenantRegistry', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        businessId: {
            field: 'business_id',
            type: DataTypes.UUID,
            allowNull: false,
            field: 'business_id',
            unique: true
        },
        schemaName: {
            field: 'schema_name',
            type: DataTypes.STRING,
            allowNull: false,
            field: 'schema_name',
            unique: true
        },
        status: {
            type: DataTypes.ENUM('active', 'suspended', 'onboarding', 'deleted', 'pending_approval', 'pending', 'pending_schema_init', 'init_failed'),
            defaultValue: 'pending_schema_init'
        },
        createdAt: {
            field: 'created_at',
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
