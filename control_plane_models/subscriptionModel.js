module.exports = (sequelize, DataTypes) => {
  const Subscription = sequelize.define('Subscription', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    businessId: {
            type: DataTypes.UUID, allowNull: false, field: 'business_id' },
    planId: {
            type: DataTypes.UUID, allowNull: false, field: 'plan_id' },
    status: { type: DataTypes.STRING, defaultValue: 'trial' },
    billingCycle: {
            type: DataTypes.STRING, field: 'billing_cycle' },
    currentPeriodStart: {
            type: DataTypes.DATE, field: 'current_period_start' },
    currentPeriodEnd: {
            type: DataTypes.DATE, field: 'current_period_end' }
  }, {
    tableName: 'subscriptions',
        underscored: true,
    timestamps: true,
    indexes: [{ fields: ['business_id'] }]
  });

  return Subscription;
};
