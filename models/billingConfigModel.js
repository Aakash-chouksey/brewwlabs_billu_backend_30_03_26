const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BillingConfig = sequelize.define('BillingConfig', {
    id: {
      field: 'id',
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    businessId: {
      field: 'business_id',
      type: DataTypes.UUID,
      allowNull: false,
      unique: true
    },
    businessName: {
      field: 'business_name',
      type: DataTypes.STRING,
      defaultValue: ''
    },
    businessAddress: {
      field: 'business_address',
      type: DataTypes.TEXT,
      defaultValue: ''
    },
    businessPhone: {
      field: 'business_phone',
      type: DataTypes.STRING,
      defaultValue: ''
    },
    businessEmail: {
      field: 'business_email',
      type: DataTypes.STRING,
      defaultValue: ''
    },
    gstNumber: {
      field: 'gst_number',
      type: DataTypes.STRING,
      defaultValue: ''
    },
    taxRate: {
      field: 'tax_rate',
      type: DataTypes.DECIMAL(5, 4),
      defaultValue: 0.05
    },
    taxInclusive: {
      field: 'tax_inclusive',
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    serviceChargeRate: {
      field: 'service_charge_rate',
      type: DataTypes.DECIMAL(5, 4),
      defaultValue: 0.00
    },
    footerText: {
      field: 'footer_text',
      type: DataTypes.STRING,
      defaultValue: 'Thank you for your business!'
    },
    themeColor: {
      field: 'theme_color',
      type: DataTypes.STRING,
      defaultValue: '#000000'
    },
    paperSize: {
      field: 'paper_size',
      type: DataTypes.STRING,
      defaultValue: 'Thermal80mm'
    },
    showLogo: {
      field: 'show_logo',
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    logoUrl: {
      field: 'logo_url',
      type: DataTypes.STRING,
      defaultValue: ''
    },
    isActive: {
      field: 'is_active',
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'billing_configs',
    timestamps: true,
    underscored: true,
    freezeTableName: true,
    indexes: [
      {
        fields: ['business_id']
      }
    ]
  });

  return BillingConfig;
};
