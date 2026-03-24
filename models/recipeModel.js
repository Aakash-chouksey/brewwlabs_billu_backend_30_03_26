const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Recipe = sequelize.define('Recipe', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        productId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'product_id'
        },
        businessId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'business_id'
        },
        outletId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'outlet_id'
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        instructions: {
            type: DataTypes.TEXT
        },
        prepTime: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            field: 'prep_time',
            comment: 'Preparation time in minutes'
        },
        isActive: {
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
        Recipe.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
        Recipe.hasMany(models.RecipeItem, { foreignKey: 'recipeId', as: 'recipeItems' });
    };

    return Recipe;
};
