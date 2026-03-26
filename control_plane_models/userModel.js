const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        businessId: {
            field: 'business_id',
            type: DataTypes.UUID,
            allowNull: false,
            comment: 'Link to business record'
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
            type: DataTypes.STRING,
            allowNull: false,
            validate: { notEmpty: true }
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: { isEmail: true, notEmpty: true }
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: true
        },
        password: {
            type: DataTypes.TEXT,
            allowNull: false,
            field: 'password_hash'
        },
        role: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        isVerified: {
            field: 'is_verified',
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            field: 'is_verified'
        },
        isActive: {
            field: 'is_active',
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            field: 'is_active'
        },
        lastLogin: {
            field: 'last_login',
            type: DataTypes.DATE,
            allowNull: true,
            field: 'last_login'
        },
        panelType: {
            field: 'panel_type',
            type: DataTypes.STRING(20),
            defaultValue: 'TENANT',
            field: 'panel_type'
        },
        status: {
            type: DataTypes.STRING(20),
            defaultValue: 'active',
            field: 'status'
        },
        salary: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            field: 'salary'
        },
        location: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'location'
        },
        experience: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: 'experience'
        },
        rating: {
            type: DataTypes.DECIMAL(3, 2),
            defaultValue: 0,
            field: 'rating'
        },
        totalOrders: {
            field: 'total_orders',
            type: DataTypes.INTEGER,
            defaultValue: 0,
            field: 'total_orders'
        },
        performance: {
            type: DataTypes.DECIMAL(5, 2),
            defaultValue: 0,
            field: 'performance'
        },
        tokenVersion: {
            field: 'token_version',
            type: DataTypes.INTEGER,
            defaultValue: 0,
            field: 'token_version'
        }
    }, {
        tableName: 'users',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        indexes: [
            { fields: ['business_id'] },
            { fields: ['business_id', 'role'] },
            { 
                name: 'users_business_email_unique',
                fields: ['business_id', 'email'],
                unique: true 
            }
        ]
    });

    User.associate = function(models) {
        User.belongsTo(models.Business, { foreignKey: 'business_id', as: 'business', constraints: false });
        User.belongsTo(models.Outlet, { foreignKey: 'outlet_id', as: 'outlet', constraints: false });
    };

    return User;
};