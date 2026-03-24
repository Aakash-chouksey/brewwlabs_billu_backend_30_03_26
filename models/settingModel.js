const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Setting = sequelize.define('Setting', {
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
        appName: { 
            type: DataTypes.STRING, 
            defaultValue: 'BrewwLabs POS',
            field: 'app_name'
        },
        logoUrl: { 
            type: DataTypes.STRING,
            field: 'logo_url'
        },
        supportEmail: { 
            type: DataTypes.STRING,
            field: 'support_email'
        },
        supportPhone: { 
            type: DataTypes.STRING,
            field: 'support_phone'
        },
        termsUrl: { 
            type: DataTypes.STRING,
            field: 'terms_url'
        },
        privacyUrl: { 
            type: DataTypes.STRING,
            field: 'privacy_url'
        },
        maintenanceMode: { 
            type: DataTypes.BOOLEAN, 
            defaultValue: false,
            field: 'maintenance_mode'
        },
        currency: {
            type: DataTypes.STRING,
            defaultValue: 'INR',
            field: 'currency'
        },
        timezone: {
            type: DataTypes.STRING,
            defaultValue: 'Asia/Kolkata',
            field: 'timezone'
        }
    }, {
        tableName: 'settings',
        timestamps: true,
        underscored: true,
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
