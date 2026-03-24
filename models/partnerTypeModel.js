const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PartnerType = sequelize.define('PartnerType', {
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
        name: { type: DataTypes.STRING, allowNull: false },
        commissionPercentage: { type: DataTypes.FLOAT, defaultValue: 0 },
        description: { type: DataTypes.STRING }
    }, {
        tableName: 'partner_types',
        timestamps: true,
        underscored: true,
        indexes: [
            { fields: ['business_id'] },
            { fields: ['business_id', 'name'], unique: true }
        ]
    });

    PartnerType.associate = function(models) {
        PartnerType.hasMany(models.PartnerMembership, { foreignKey: 'partnerTypeId', as: 'memberships' });
    };

    return PartnerType;
};
