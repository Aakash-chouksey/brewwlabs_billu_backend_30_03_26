module.exports = (sequelize, DataTypes) => {
  const TenantConnection = sequelize.define('TenantConnection', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    businessId: {
            type: DataTypes.UUID, 
      allowNull: false,
      field: 'business_id',
      unique: true,
      references: {
        model: 'businesses',
        key: 'id'
      }
    },
    dbName: {
            type: DataTypes.STRING, 
      allowNull: false, 
      field: 'db_name',
      validate: { notEmpty: true }
    },
    dbHost: {
            type: DataTypes.STRING, 
      allowNull: false, 
      field: 'db_host',
      validate: { notEmpty: true }
    },
    dbPort: {
            type: DataTypes.INTEGER, 
      defaultValue: 5432, 
      field: 'db_port'
    },
    dbUser: {
            type: DataTypes.STRING, 
      allowNull: false, 
      field: 'db_user'
    },
    encryptedPassword: {
            type: DataTypes.TEXT, 
      allowNull: false, 
      field: 'encrypted_password'
    },
    encryptionVersion: {
        field: 'encryption_version',
            type: DataTypes.STRING(10),
      defaultValue: 'v2',
      field: 'encryption_version'
    },
    dbRegion: {
            type: DataTypes.STRING(50),
      allowNull: true,
      field: 'db_region'
    },
    poolMaxConnections: {
            type: DataTypes.INTEGER,
      defaultValue: 10,
      field: 'pool_max_connections'
    },
    poolMinConnections: {
            type: DataTypes.INTEGER,
      defaultValue: 1,
      field: 'pool_min_connections'
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'active',
      field: 'status'
    }
  }, {
    tableName: 'tenant_connections',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['business_id'], unique: true },
      { fields: ['status'] }
    ]
  });

  TenantConnection.associate = function(models) {
    TenantConnection.belongsTo(models.Business, { foreignKey: 'business_id', as: 'business' });
  };

  return TenantConnection;
};
