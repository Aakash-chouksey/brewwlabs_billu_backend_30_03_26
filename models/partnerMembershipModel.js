const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PartnerMembership = sequelize.define('PartnerMembership', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        businessId: { type: DataTypes.UUID, allowNull: false },
        planId: { type: DataTypes.UUID, allowNull: false },
        startDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        endDate: { type: DataTypes.DATE },
        status: { type: DataTypes.STRING, defaultValue: 'active' },
        paymentId: { type: DataTypes.STRING }
    }, {
        timestamps: true
    });

    return PartnerMembership;
};
