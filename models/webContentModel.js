const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const WebContent = sequelize.define('WebContent', {
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
        outletId: {
            field: 'outlet_id',
            type: DataTypes.UUID,
            allowNull: true,
            field: 'outlet_id'
        },
        page: { type: DataTypes.STRING, allowNull: false }, // e.g., 'home', 'about', 'contact'
        title: { type: DataTypes.STRING },
        content: { type: DataTypes.TEXT },
        metaDescription: {
            field: 'meta_description',
            type: DataTypes.STRING },
        images: { type: DataTypes.JSONB, defaultValue: [] }
    }, {
        tableName: 'web_contents',
        timestamps: true,
        underscored: true,
        freezeTableName: true,
        indexes: [
            { fields: ['business_id'] },
            { fields: ['business_id', 'outlet_id'] },
            { fields: ['business_id', 'page'], unique: true }
        ]
    });

    WebContent.associate = function(models) {
        // REMOVED cross-schema association to Business
        WebContent.belongsTo(models.Outlet, { foreignKey: 'outlet_id', as: 'outlet' });
    };

    return WebContent;
};
