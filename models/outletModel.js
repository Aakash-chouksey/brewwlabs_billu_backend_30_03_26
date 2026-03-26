const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Outlet = sequelize.define('Outlet', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        businessId: {
            field: 'business_id',
            type: DataTypes.UUID,
            allowNull: false,
            field: 'business_id'
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: { notEmpty: true }
        },
        address: {
            type: DataTypes.TEXT
        },
        managerUserId: {
            field: 'manager_user_id',
            type: DataTypes.UUID,
            allowNull: true,
            field: 'manager_user_id'
        },
        parentOutletId: {
            field: 'parent_outlet_id',
            type: DataTypes.UUID,
            allowNull: true,
            field: 'parent_outlet_id'
        },
        isHeadOffice: {
            field: 'is_head_office',
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            field: 'is_head_office'
        },
        email: {
            type: DataTypes.STRING,
            allowNull: true
        },
        status: {
            type: DataTypes.STRING,
            defaultValue: 'active'
        },
        isActive: {
            field: 'is_active',
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            field: 'is_active'
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
        // REMOVED cross-schema association to Business
        // Self-referencing for franchise hierarchy
        Outlet.belongsTo(models.Outlet, { foreignKey: 'parent_outlet_id', as: 'parentOutlet' });
        Outlet.hasMany(models.Outlet, { foreignKey: 'parent_outlet_id', as: 'childOutlets' });
        // REMOVED cross-schema association to User
    };

    return Outlet;
};
