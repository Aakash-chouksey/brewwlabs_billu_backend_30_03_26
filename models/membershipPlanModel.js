const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const MembershipPlan = sequelize.define('MembershipPlan', {
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
        name: { type: DataTypes.STRING, allowNull: false },
        price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        durationDays: {
            field: 'duration_days',
            type: DataTypes.INTEGER, allowNull: false },
        outletsLimit: {
            field: 'outlets_limit',
            type: DataTypes.INTEGER, defaultValue: 1 },
        staffLimit: {
            field: 'staff_limit',
            type: DataTypes.INTEGER, defaultValue: 5 },
        maxProducts: {
            field: 'max_products',
            type: DataTypes.INTEGER, defaultValue: 100 },
        maxInvoices: {
            field: 'max_invoices',
            type: DataTypes.INTEGER, defaultValue: 1000 }, // Per month
        apiRateLimit: {
            field: 'api_rate_limit',
            type: DataTypes.INTEGER, defaultValue: 60 }, // Requests per minute
        features: { type: DataTypes.JSONB, defaultValue: [] },
        isActive: {
            field: 'is_active',
            type: DataTypes.BOOLEAN, defaultValue: true }
    }, {
        tableName: 'membership_plans',
        underscored: true,
        freezeTableName: true,
        timestamps: true
    });

    return MembershipPlan;
};
