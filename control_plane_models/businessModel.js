const { DataTypes } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const Business = sequelize.define('Business', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: { 
      type: DataTypes.STRING, 
      allowNull: false,
      validate: { notEmpty: true }
    },
    email: { 
      type: DataTypes.STRING, 
      allowNull: false, 
      unique: true,
      validate: { isEmail: true, notEmpty: true }
    },
    phone: { 
      type: DataTypes.STRING 
    },
    gstNumber: {
            type: DataTypes.STRING,
      field: 'gst_number',
      comment: 'GST Number for tax compliance'
    },
    address: { 
      type: DataTypes.TEXT 
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'SOLO',
      comment: 'SOLO = single cafe, FRANCHISE = multiple outlets'
    },
    ownerId: {
            type: DataTypes.UUID,
      field: 'owner_id',
      comment: 'Primary owner of the business'
    },
    isActive: {
        field: 'is_active',
            type: DataTypes.BOOLEAN, 
      allowNull: false,
      defaultValue: true,
      field: 'is_active'
    },
    status: { 
      type: DataTypes.STRING, 
      allowNull: false,
      defaultValue: 'active' 
    },
    subscription_plan: {
      type: DataTypes.STRING,
      defaultValue: 'free'
    },
    businessId: {
            type: DataTypes.UUID,
      allowNull: true,
      field: 'business_id',
      comment: 'Self-reference for business hierarchy'
    },
    settings: { 
      type: DataTypes.JSON, 
      defaultValue: {},
      field: 'settings'
    }
  }, {
    tableName: 'businesses',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['email'], unique: true },
      { fields: ['status'] },
      { fields: ['type'] },
      { fields: ['owner_id'] }
    ]
  });

  Business.associate = function(models) {
    Business.hasOne(models.TenantConnection, { foreignKey: 'business_id', as: 'connection' });
  };

  return Business;
};
