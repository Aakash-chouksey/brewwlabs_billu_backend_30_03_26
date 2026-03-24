const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Category = sequelize.define('Category', {
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
        outletId: {
            type: DataTypes.UUID,
            allowNull: false, // 🚨 Phase 4: Enforce strict outlet isolation
            field: 'outlet_id'
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            field: 'description'
        },
        color: {
            type: DataTypes.STRING,
            defaultValue: '#3B82F6',
            field: 'color'
        },
        image: {
            type: DataTypes.STRING,
            field: 'image'
        },
        isEnabled: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            field: 'is_enabled'
        },
        sortOrder: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            field: 'sort_order'
        }
    }, {
        tableName: 'categories',
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['business_id'] }
        ]
    });

    Category.associate = function(models) {
        Category.belongsTo(models.Business, { foreignKey: 'business_id', as: 'business' });
        Category.belongsTo(models.Outlet, { foreignKey: 'outlet_id', as: 'outlet' });
        Category.hasMany(models.Product, { foreignKey: 'category_id', as: 'products' });
    };

    return Category;
};
