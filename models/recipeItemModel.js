const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const RecipeItem = sequelize.define('RecipeItem', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        recipeId: {
            field: 'recipe_id',
            type: DataTypes.UUID,
            allowNull: false,
            field: 'recipe_id'
        },
        inventoryItemId: {
            field: 'inventory_item_id',
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
        quantityRequired: {
            field: 'quantity_required',
            type: DataTypes.DECIMAL(10, 3),
            allowNull: false
        },
        unit: {
            type: DataTypes.STRING,
            allowNull: false
        },
        isOptional: {
            field: 'is_optional',
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            field: 'is_optional'
        },
        notes: {
            type: DataTypes.TEXT
        }
    }, {
        tableName: 'recipe_items',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['business_id'] },
            { fields: ['business_id', 'outlet_id'] },
            { fields: ['recipe_id'] },
            { fields: ['inventory_item_id'] },
            { fields: ['recipe_id', 'inventory_item_id'], unique: true },
            { fields: ['business_id', 'outlet_id', 'recipe_id'] }
        ]
    });

    RecipeItem.associate = (models) => {
        RecipeItem.belongsTo(models.Recipe, { foreignKey: 'recipe_id', as: 'recipe' });
        RecipeItem.belongsTo(models.InventoryItem, { foreignKey: 'inventory_item_id', as: 'inventoryItem' });
    };

    return RecipeItem;
};
