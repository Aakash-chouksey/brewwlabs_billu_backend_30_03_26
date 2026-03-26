module.exports = (sequelize, DataTypes) => {
  const Plan = sequelize.define('Plan', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    billingCycle: {
            type: DataTypes.STRING,
      defaultValue: 'monthly',
      field: 'billing_cycle'
    },
    features: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    limits: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    isActive: {
            type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    isPublic: {
            type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_public'
    },
    sortOrder: {
            type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'sort_order'
    },
    trialDays: {
            type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'trial_days'
    }
  }, {
    tableName: 'plans',
        underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['slug'], unique: true },
      { fields: ['is_active'] },
      { fields: ['is_public'] }
    ]
  });

  return Plan;
};
