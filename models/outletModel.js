const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Outlet = sequelize.define('Outlet', {
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
        name: {
            field: 'name',
            type: DataTypes.STRING,
            allowNull: false,
            validate: { notEmpty: true }
        },
        address: {
            field: 'address',
            type: DataTypes.TEXT
        },
        managerUserId: {
            field: 'manager_user_id',
            type: DataTypes.UUID,
            allowNull: true
        },
        isHeadOffice: {
            field: 'is_head_office',
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        email: {
            field: 'email',
            type: DataTypes.STRING,
            allowNull: true
        },
        status: {
            field: 'status',
            type: DataTypes.STRING,
            defaultValue: 'active'
        },
        phone: {
            field: 'phone',
            type: DataTypes.STRING,
            allowNull: true
        },
        gstNumber: {
            field: 'gst_number',
            type: DataTypes.STRING,
            allowNull: true
        },
        parentOutletId: {
            field: 'parent_outlet_id',
            type: DataTypes.UUID,
            allowNull: true
        },
        isActive: {
            field: 'is_active',
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        tableName: 'outlets',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['business_id'] },
            { fields: ['parent_outlet_id'] }
        ]
    });

    Outlet.associate = function(models) {
        // Self-referencing for franchise hierarchy
        Outlet.belongsTo(models.Outlet, { foreignKey: 'parentOutletId', as: 'parentOutlet' });
        Outlet.hasMany(models.Outlet, { foreignKey: 'parentOutletId', as: 'childOutlets' });
        
        // Outlet has many Users (cross-schema but necessary)
        if (models.User) {
            Outlet.hasMany(models.User, { 
                foreignKey: 'outlet_id', 
                as: 'users',
                constraints: false // Cross-schema, no FK constraint
            });
        }
    };

    return Outlet;
};
