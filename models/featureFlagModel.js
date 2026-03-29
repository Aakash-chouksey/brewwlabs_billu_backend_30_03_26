const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const FeatureFlag = sequelize.define('FeatureFlag', {
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
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        description: {
            type: DataTypes.STRING,
            allowNull: true
        },
        isEnabled: {
            field: 'is_enabled',
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        rolloutPercentage: {
            field: 'rollout_percentage',
            type: DataTypes.INTEGER,
            defaultValue: 0, // 0-100
            validate: { min: 0, max: 100 }
        },
        targetUsers: {
            field: 'target_users',
            type: DataTypes.JSONB, // Array of User/Business IDs
            defaultValue: []
        },
        targetPlan: {
            field: 'target_plan',
            type: DataTypes.STRING, // 'free', 'pro', etc. or null for all
            allowNull: true
        }
    }, {
        tableName: 'feature_flags',
        underscored: true,
        freezeTableName: true,
        timestamps: true
    });

    return FeatureFlag;
};
