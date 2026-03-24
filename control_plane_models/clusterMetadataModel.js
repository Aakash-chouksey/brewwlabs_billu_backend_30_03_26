module.exports = (sequelize, DataTypes) => {
  const ClusterMetadata = sequelize.define('ClusterMetadata', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    cluster_name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    db_host: {
      type: DataTypes.STRING,
      allowNull: false
    },
    db_port: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5432
    },
    max_tenants: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100
    },
    current_tenants: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    region: {
      type: DataTypes.STRING,
      allowNull: false
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'active'
    }
  }, {
    tableName: 'cluster_metadata',
    timestamps: true,
    indexes: [
      { fields: ['region'] },
      { fields: ['status'] },
      { fields: ['cluster_name'] }
    ]
  });

  return ClusterMetadata;
};
