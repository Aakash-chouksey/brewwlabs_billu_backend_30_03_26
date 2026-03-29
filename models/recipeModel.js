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
            field: 'name',
            type: DataTypes.STRING,
            allowNull: false
        },
        instructions: {
            field: 'instructions',
            type: DataTypes.TEXT
        },
        prepTime: {
            field: 'prep_time',
            type: DataTypes.INTEGER,
            defaultValue: 0,
            comment: 'Preparation time in minutes'
        },
        version: {
            field: 'version',
            type: DataTypes.INTEGER,
            defaultValue: 1
        },
        isActive: {
            field: 'is_active',
            type: DataTypes.BOOLEAN,
            defaultValue: true
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
