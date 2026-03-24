const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Business = sequelize.define('Business', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        address: {
            type: DataTypes.STRING
        },
        phone: {
            type: DataTypes.STRING
        },
        gstNumber: {
            type: DataTypes.STRING,
            field: 'gst_number'
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },

        status: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'active'
        },
        subscription_plan: {
            type: DataTypes.STRING,
            defaultValue: 'free'
        },
        ownerId: {
            type: DataTypes.UUID,
            allowNull: true
        },
        businessId: {
            type: DataTypes.UUID,
            allowNull: true,
            field: 'business_id',
            comment: 'Self-reference for business hierarchy'
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'SOLO'
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            field: 'is_active'
        },
        settings: {
            type: DataTypes.JSON,
            defaultValue: {}
        }
    }, {
        tableName: 'businesses',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        underscored: true,
        indexes: [
            {
                fields: ['owner_id']
            },
            {
                fields: ['status']
            },
            {
                fields: ['email']
            },
            {
                fields: ['business_id']
            }
        ],
        validate: {
            businessIntegrity() {
                if (this.ownerId) {
                    console.log(`Business ${this.id} properly linked to owner ${this.ownerId}`);
                }
            }
        }
    });

    return Business;
};