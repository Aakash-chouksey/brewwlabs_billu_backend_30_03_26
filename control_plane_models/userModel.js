const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            field: 'id'
        },
        businessId: {
            field: 'business_id',
            type: DataTypes.UUID,
            allowNull: false
        },
        outletId: {
            field: 'outlet_id',
            type: DataTypes.UUID,
            allowNull: true
        },
        outletIds: {
            field: 'outlet_ids',
            type: DataTypes.JSONB,
            defaultValue: []
        },
        name: {
            field: 'name',
            type: DataTypes.STRING,
            allowNull: false
        },
        email: {
            field: 'email',
            type: DataTypes.STRING,
            allowNull: false
        },
        phone: {
            field: 'phone',
            type: DataTypes.STRING,
            allowNull: true
        },
        password: {
            field: 'password_hash',
            type: DataTypes.TEXT,
            allowNull: false
        },
        role: {
            field: 'role',
            type: DataTypes.STRING(50),
            allowNull: false
        },
        isVerified: {
            field: 'is_verified',
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        isActive: {
            field: 'is_active',
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        lastLogin: {
            field: 'last_login',
            type: DataTypes.DATE,
            allowNull: true
        },
        panelType: {
            field: 'panel_type',
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'TENANT'
        },
        status: {
            field: 'status',
            type: DataTypes.STRING(20),
            defaultValue: 'PENDING',
            set(value) {
                // ENFORCE: Always store status as UPPERCASE
                this.setDataValue('status', value ? value.toUpperCase() : 'PENDING');
            }
        },
        tokenVersion: {
            field: 'token_version',
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
    }, {
        tableName: 'users',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    // Define associations
    User.associate = function(models) {
        // User belongs to Outlet (cross-schema but necessary for tenant context)
        if (models.Outlet) {
            User.belongsTo(models.Outlet, { 
                foreignKey: 'outlet_id', 
                as: 'outlet',
                constraints: false // Cross-schema, no FK constraint
            });
        }
        
        // User belongs to Business (both control models)
        if (models.Business) {
            User.belongsTo(models.Business, { 
                foreignKey: 'business_id', 
                as: 'business' 
            });
        }
    };

    return User;
};