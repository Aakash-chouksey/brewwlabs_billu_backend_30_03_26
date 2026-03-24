module.exports = (sequelize, DataTypes) => {
  const SuperAdminUser = sequelize.define('SuperAdminUser', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    email: { type: DataTypes.STRING, unique: true, allowNull: false },
    passwordHash: { type: DataTypes.STRING, allowNull: false, field: 'password_hash' },
    role: { type: DataTypes.STRING, defaultValue: 'SUPER_ADMIN' },
    tokenVersion: { type: DataTypes.INTEGER, defaultValue: 0, field: 'token_version' }
  }, {
    tableName: 'super_admin_users',
    timestamps: true
  });

  return SuperAdminUser;
};
