const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Category = sequelize.define('Category', {
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
            type: DataTypes.TEXT
        },
        color: {
            field: 'color',
            type: DataTypes.STRING,
            defaultValue: '#3B82F6'
        },
        image: {
            field: 'image',
            type: DataTypes.STRING
        },
        isEnabled: {
            field: 'is_enabled',
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        sortOrder: {
            field: 'sort_order',
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
    }, {
        tableName: 'categories',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['business_id'] }
        ]
    });

    Category.associate = function(models) {
        // REMOVED cross-schema association to Business
        Category.belongsTo(models.Outlet, { foreignKey: 'outletId', as: 'outlet' });
        Category.hasMany(models.Product, { foreignKey: 'categoryId', as: 'products' });
    };

    return Category;
};
