const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PartnerMembership = sequelize.define('PartnerMembership', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        businessId: {
            field: 'business_id',
            type: DataTypes.UUID, allowNull: false },
        planId: {
            field: 'plan_id',
            type: DataTypes.UUID, allowNull: false },
        startDate: {
            field: 'start_date',
            type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        endDate: {
            field: 'end_date',
            type: DataTypes.DATE },
        status: { type: DataTypes.STRING, defaultValue: 'active' },
        paymentId: {
            field: 'payment_id',
            type: DataTypes.STRING }
    }, {
        tableName: 'partner_memberships',
        underscored: true,
        freezeTableName: true,
        timestamps: true
    });

    return PartnerMembership;
};
