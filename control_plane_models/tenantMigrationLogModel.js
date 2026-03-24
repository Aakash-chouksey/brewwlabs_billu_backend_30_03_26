module.exports = (sequelize, DataTypes) => {
  const TenantMigrationLog = sequelize.define('TenantMigrationLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    businessId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'business_id',
      comment: 'Business ID for which migration was executed'
    },
    migration_version: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Migration version number'
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'started'
    },
    executed_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'tenant_migration_log',
    timestamps: true,
    indexes: [
      { fields: ['business_id'] },
      { fields: ['migration_version'] },
      { fields: ['status'] },
      { fields: ['executed_at'] }
    ]
  });

  return TenantMigrationLog;
};
