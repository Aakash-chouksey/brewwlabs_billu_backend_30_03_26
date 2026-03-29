const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Setting = sequelize.define('Setting', {
        id: {
            field: 'id',
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        businessId: {
            field: 'business_id',
            type: DataTypes.UUID,
            allowNull: false
        },
        appName: {
            field: 'app_name',
            type: DataTypes.STRING, 
            defaultValue: 'BrewwLabs POS'
        },
        logoUrl: {
            field: 'logo_url',
            type: DataTypes.STRING
        },
        supportEmail: {
            field: 'support_email',
            type: DataTypes.STRING
        },
        supportPhone: {
            field: 'support_phone',
            type: DataTypes.STRING
        },
        termsUrl: {
            field: 'terms_url',
            type: DataTypes.STRING
        },
        privacyUrl: {
            field: 'privacy_url',
            type: DataTypes.STRING
        },
        maintenanceMode: {
            field: 'maintenance_mode',
            type: DataTypes.BOOLEAN, 
            defaultValue: false
        },
        currency: {
            field: 'currency',
            type: DataTypes.STRING,
            defaultValue: 'INR'
        },
        timezone: {
            field: 'timezone',
            type: DataTypes.STRING,
            defaultValue: 'Asia/Kolkata'
        }
    }, {
        tableName: 'settings',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['business_id'] }
        ]
    });

    // Helper to get singleton settings
    Setting.getSettings = async function() {
        let settings = await this.findOne();
        if (!settings) {
            settings = await this.create({});
        }
        return settings;
    };

    return Setting;
};
