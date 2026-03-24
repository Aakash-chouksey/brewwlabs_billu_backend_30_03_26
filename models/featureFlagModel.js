const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const FeatureFlag = sequelize.define('FeatureFlag', {
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
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        rolloutPercentage: {
            type: DataTypes.INTEGER,
            defaultValue: 0, // 0-100
            validate: { min: 0, max: 100 }
        },
        targetUsers: {
            type: DataTypes.JSONB, // Array of User/Business IDs
            defaultValue: []
        },
        targetPlan: {
            type: DataTypes.STRING, // 'free', 'pro', etc. or null for all
            allowNull: true
        }
    }, {
        timestamps: true
    });

    return FeatureFlag;
};
