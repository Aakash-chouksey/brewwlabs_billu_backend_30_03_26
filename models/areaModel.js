const { DataTypes } = require('sequelize');

// Factory function to create Area model for given sequelize instance
module.exports = (sequelize) => {
    const Area = sequelize.define('Area', {
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
        outletId: {
            field: 'outlet_id',
            type: DataTypes.UUID,
            allowNull: false
        },
        name: {
            field: 'name',
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            field: 'description',
            type: DataTypes.STRING,
            allowNull: true
        },
        capacity: {
            field: 'capacity',
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 20
        },
        layout: {
            field: 'layout',
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: 'square'
        },
        status: {
            field: 'status',
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: 'active'
        }
    }, {
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        tableName: 'table_areas',
        indexes: [
            { fields: ['business_id'] },
            { fields: ['business_id', 'outlet_id'] }
        ]
    });

    // Define associations
    Area.associate = function(models) {
        Area.hasMany(models.Table, { foreignKey: 'areaId', as: 'tables' });
        Area.belongsTo(models.Outlet, { foreignKey: 'outletId', as: 'outlet' });
    };

    return Area;
};
