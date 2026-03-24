const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const RecipeItem = sequelize.define('RecipeItem', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        recipeId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'recipe_id'
        },
        inventoryItemId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'inventory_item_id'
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
        quantityRequired: {
            type: DataTypes.DECIMAL(10, 3),
            allowNull: false,
            field: 'quantity_required'
        },
        unit: {
            type: DataTypes.STRING,
            allowNull: false
        },
        isOptional: {
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
        RecipeItem.belongsTo(models.Recipe, { foreignKey: 'recipeId', as: 'recipe' });
        RecipeItem.belongsTo(models.InventoryItem, { foreignKey: 'inventoryItemId', as: 'InventoryItem' });
    };

    return RecipeItem;
};
