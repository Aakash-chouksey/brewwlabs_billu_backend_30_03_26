const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Recipe = sequelize.define('Recipe', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        productId: {
            field: 'product_id',
            type: DataTypes.UUID,
            allowNull: false
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
            type: DataTypes.STRING,
            allowNull: false
        },
        instructions: {
            type: DataTypes.TEXT
        },
        prepTime: {
            field: 'prep_time',
            type: DataTypes.INTEGER,
            defaultValue: 0,
            field: 'prep_time',
            comment: 'Preparation time in minutes'
        },
        isActive: {
            field: 'is_active',
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            field: 'is_active'
        },
        version: {
            type: DataTypes.INTEGER,
            defaultValue: 1
        }
    }, {
        tableName: 'recipes',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['business_id'] },
            { fields: ['business_id', 'outlet_id'] },
            { fields: ['product_id'] },
            { fields: ['business_id', 'outlet_id', 'product_id'], unique: true },
            { fields: ['business_id', 'outlet_id', 'is_active'] }
        ]
    });

    Recipe.associate = (models) => {
        Recipe.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
        Recipe.hasMany(models.RecipeItem, { foreignKey: 'recipe_id', as: 'ingredients' });
    };

    return Recipe;
};
