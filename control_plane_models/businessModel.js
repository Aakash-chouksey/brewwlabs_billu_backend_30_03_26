const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Business = sequelize.define('Business', {
    id: {
      field: 'id',
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      field: 'name',
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      field: 'email',
      type: DataTypes.STRING,
      allowNull: false
    },
    phone: {
      field: 'phone',
      type: DataTypes.STRING,
      allowNull: true
    },
    address: {
      field: 'address',
      type: DataTypes.TEXT,
      allowNull: true
    },
    gstNumber: {
      field: 'gst_number',
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'GST Number for tax compliance'
    },
    type: {
      field: 'type',
      type: DataTypes.STRING(50),
      defaultValue: 'SOLO'
    },
    status: {
      field: 'status',
      type: DataTypes.STRING(20),
      defaultValue: 'PENDING',
      set(value) {
        // ENFORCE: Always store status as UPPERCASE
        this.setDataValue('status', value ? value.toUpperCase() : 'PENDING');
      }
    },
    ownerId: {
      field: 'owner_id',
      type: DataTypes.UUID,
      allowNull: true
    },
    isActive: {
      field: 'is_active',
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'businesses',
    timestamps: true,
    underscored: true,
    freezeTableName: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return Business;
};
