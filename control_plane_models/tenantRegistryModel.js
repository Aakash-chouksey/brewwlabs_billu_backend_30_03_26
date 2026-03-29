const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const TenantRegistry = sequelize.define('TenantRegistry', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            field: 'id'
        },
        businessId: {
            field: 'business_id',
            type: DataTypes.UUID,
            allowNull: false,
            comment: 'Link to business record'
        },
        schemaName: {
            field: 'schema_name',
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        status: {
            field: 'status',
            type: DataTypes.STRING(50),
            defaultValue: 'CREATING',
            set(value) {
                // ENFORCE: Always store status as UPPERCASE
                this.setDataValue('status', value ? value.toUpperCase() : 'CREATING');
            },
            validate: {
                isIn: [['ACTIVE', 'READY', 'PENDING', 'CREATING', 'ONBOARDING', 'SUSPENDED', 'INACTIVE', 'INIT_FAILED', 'INIT_IN_PROGRESS', 'TRIAL']]
            }
        },
        retryCount: {
            field: 'retry_count',
            type: DataTypes.INTEGER,
            defaultValue: 0,
            comment: 'Number of onboarding retry attempts'
        },
        lastError: {
            field: 'last_error',
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Last error message during onboarding'
        },
        activatedAt: {
            field: 'activated_at',
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'When tenant was activated'
        },
        createdAt: {
            field: 'created_at',
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        updatedAt: {
            field: 'updated_at',
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'tenant_registry',
        timestamps: true,
        underscored: true,
        freezeTableName: true
    });

    return TenantRegistry;
};
