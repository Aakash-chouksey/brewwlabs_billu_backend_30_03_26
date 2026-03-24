const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const MembershipPlan = sequelize.define('MembershipPlan', {
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
        price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        durationDays: { type: DataTypes.INTEGER, allowNull: false },
        outletsLimit: { type: DataTypes.INTEGER, defaultValue: 1 },
        staffLimit: { type: DataTypes.INTEGER, defaultValue: 5 },
        maxProducts: { type: DataTypes.INTEGER, defaultValue: 100 },
        maxInvoices: { type: DataTypes.INTEGER, defaultValue: 1000 }, // Per month
        apiRateLimit: { type: DataTypes.INTEGER, defaultValue: 60 }, // Requests per minute
        features: { type: DataTypes.JSONB, defaultValue: [] },
        isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
    }, {
        timestamps: true
    });

    return MembershipPlan;
};
